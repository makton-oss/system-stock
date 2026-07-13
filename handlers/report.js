const { withRole } = require("../core/withRole");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getInventoryReport, getFlowReport, getDeadReport, getDetailReport } = require("../services/reportService");
const { getSummaryReport } = require("../services/reports/summaryReport");
const { getOwnerReport } = require("../services/reports/ownerSummary");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");
const { formatSummaryReport, formatInventoryReport, formatDetailReport, formatDeadReport, formatFlowReport, parseMonthInput, formatMonthLabel } = require("../utils/formatter");
const { formatMonthlyOwnerReport } = require("../utils/formatters/monthlyReportFormat");
const { getMonthlyOwnerReport } = require("../services/reports/monthlyOwnerReport");
const { DateTime } = require("luxon");

module.exports = withRole(["manager", "owner", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const isSuperadmin = user.role === "superadmin";
  const isAdmin      = user.role === "admin" || isSuperadmin;
  const tenantId     = user.tenant_id || null;

  // ======================
  // SUPERADMIN — wajib @slug untuk semua report modes
  // Fix: sebelum ni superadmin dapat data SEMUA tenant (cross-tenant leak)
  // ======================
  if (isSuperadmin) {
    const slugArg = parts[1];
    if (!slugArg?.startsWith("@")) {
      await reply(chatId, "❌ FORMAT: REPORT @slugtenant [MODE] [bulan]\n\nContoh:\nREPORT @kedaimaju FULL\nREPORT @kedaimaju SUMMARY may-26\nREPORT @kedaimaju FLOW jun-26");
      return res.end();
    }

    const slug = slugArg.slice(1);
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      await reply(chatId, `❌ TENANT TAK WUJUD: ${slug}`);
      return res.end();
    }

    // Rebuild parts tanpa @slug supaya logic bawah boleh reuse
    // parts[0] = REPORT, parts[1] = @slug, parts[2] = MODE, parts[3] = bulan
    // → remap jadi parts[0] = REPORT, parts[1] = MODE, parts[2] = bulan
    const remappedParts = ["REPORT", ...parts.slice(2)];

    return await handleReport(ctx, {
      tenantId:  tenant.id,
      parts:     remappedParts,
      isAdmin:   true,
      isSuperadmin,
      outletIds: null // akan resolve dalam handleReport ikut mode
    });
  }

  // ======================
  // ADMIN (tenant-scoped)
  // ======================
  if (isAdmin) {
    return await handleReport(ctx, {
      tenantId,
      parts,
      isAdmin:   true,
      isSuperadmin: false,
      outletIds: null
    });
  }

  // ======================
  // MANAGER / OWNER
  // ======================
  const outletIds = await getAccessibleOutletIds(user);

  if (!outletIds?.length) {
    await reply(chatId, "❌ TIADA AKSES OUTLET");
    return res.end();
  }

  return await handleReport(ctx, {
    tenantId,
    parts,
    isAdmin:   false,
    isSuperadmin: false,
    outletIds
  });
});

// ======================
// CORE HANDLER — semua role masuk sini lepas resolve tenantId + outletIds
// ======================
async function handleReport(ctx, { tenantId, parts, isAdmin, isSuperadmin, outletIds: passedOutletIds }) {

  const { chatId, user, reply, res } = ctx;

  const REPORT_MODES = ["FLOW", "DEAD", "DETAIL", "INVENTORY", "COMPARE", "FULL"];
  const first = parts[1]?.toUpperCase();

  let mode       = null;
  let monthInput = "current";

  if (!first) {
    mode       = null;
    monthInput = "current";
  } else if (first === "SUMMARY") {
    mode       = null;
    monthInput = parts[2]?.toLowerCase() || "current";
  } else if (REPORT_MODES.includes(first)) {
    mode       = first;
    monthInput = parts[2]?.toLowerCase() || "current";
  } else {
    mode       = null;
    monthInput = first.toLowerCase();
  }

  // Resolve outletIds — admin/superadmin guna null (all outlets in tenant),
  // manager/owner guna passedOutletIds yang dah di-resolve sebelum masuk sini
  const outletIds = passedOutletIds;

  // ======================
  // FULL — OWNER MONTHLY (with insights)
  // Manager & admin boleh juga, tapi tiada outlet comparison jika 1 outlet je
  // ======================
  if (mode === "FULL") {

    try {
      // Untuk FULL, owner/manager guna passedOutletIds
      // Admin guna null → semua outlet dalam tenant
      const fullOutletIds = isAdmin ? null : outletIds;

      const result = await getMonthlyOwnerReport({
        mode:       monthInput !== "current" ? "monthly" : "dayrange",
        monthInput: monthInput !== "current" ? monthInput : null,
        outletIds:  fullOutletIds,
        tenantId
      });

      if (result.error === "INVALID_MONTH") {
        await reply(chatId, "❌ FORMAT: REPORT FULL [bulan]\n\nContoh: REPORT FULL may-26");
        return res.end();
      }

      if (result.error) throw result.error;

      await reply(chatId, formatMonthlyOwnerReport(result));

    } catch (err) {
      console.log("FULL REPORT ERROR:", err);
      await reply(chatId, "❌ REPORT ERROR");
    }

    return res.end();
  }

  // ======================
  // COMPARE — OWNER + ADMIN
  // ======================
  if (mode === "COMPARE") {

    if (user.role === "manager") {
      await reply(chatId, "❌ NO ACCESS");
      return res.end();
    }

    // Owner guna outletIds dia, admin/superadmin guna null
    const compareOutletIds = isAdmin ? null : outletIds;
    const compareMode      = monthInput !== "current" ? "monthly" : "dayrange";

    try {
      const result = await getOwnerReport({
        mode:       compareMode,
        monthInput: monthInput !== "current" ? monthInput : null,
        outletIds:  compareOutletIds,
        tenantId
      });

      if (result.error === "INVALID_MONTH") {
        await reply(chatId, "❌ FORMAT: REPORT COMPARE may-26");
        return res.end();
      }

      if (result.error) throw result.error;

      await reply(chatId, formatMonthlyOwnerReport({
        data:          result.data,
        label:         result.label,
        lowStock:      [],
        deadStockCount: 0,
        insights:      [],
        health:        null
      }));

    } catch (err) {
      console.log("COMPARE REPORT ERROR:", err);
      await reply(chatId, "❌ REPORT ERROR");
    }

    return res.end();
  }

  // ======================
  // INVENTORY
  // ======================
  if (mode === "INVENTORY") {

    const range = parseMonthInput(monthInput);

    if (!range) {
      await reply(chatId, "❌ FORMAT: REPORT INVENTORY may-26");
      return res.end();
    }

    let snapshotDate;
    if (range.isDayRange) {
      const todayKL = DateTime.now().setZone("Asia/Kuala_Lumpur");
      const endKL   = DateTime.fromJSDate(range.end).setZone("Asia/Kuala_Lumpur");
      const target  = endKL.hasSame(todayKL, "day") ? todayKL.minus({ days: 1 }) : endKL;
      snapshotDate  = target.toFormat("yyyy-MM-dd");
    } else {
      const endKL  = DateTime.fromJSDate(range.end).setZone("Asia/Kuala_Lumpur").minus({ days: 1 });
      snapshotDate = endKL.toFormat("yyyy-MM-dd");
    }

    const monthLabel = formatMonthLabel(monthInput, range.start.toISOString());

    try {
      const result = await getInventoryReport({ outletIds, snapshotDate, tenantId });
      if (result.error) throw result.error;
      await reply(chatId, formatInventoryReport(result, monthLabel));

    } catch (err) {
      console.log("INVENTORY REPORT ERROR:", err);
      await reply(chatId, "❌ REPORT ERROR");
    }

    return res.end();
  }

  // ======================
  // DEAD STOCK
  // ======================
  if (mode === "DEAD") {

    const range = parseMonthInput(monthInput);

    if (!range) {
      await reply(chatId, "❌ FORMAT: REPORT DEAD may-26");
      return res.end();
    }

    const asOfDate = range.isDayRange
      ? new Date(range.end).toISOString()
      : new Date(new Date(range.end).getTime() - 1).toISOString();

    const monthLabel = formatMonthLabel(monthInput, range.start.toISOString());

    try {
      const result = await getDeadReport({ outletIds, tenantId, asOfDate });
      if (result.error) throw result.error;
      await reply(chatId, formatDeadReport(result, monthLabel));

    } catch (err) {
      console.log("DEAD REPORT ERROR:", err);
      await reply(chatId, "❌ REPORT ERROR");
    }

    return res.end();
  }

  // ======================
  // FLOW / DETAIL / SUMMARY — month parse
  // ======================
  const range = parseMonthInput(monthInput);

  if (!range) {
    await reply(chatId, "❌ FORMAT: REPORT may-26");
    return res.end();
  }

  const start      = range.start.toISOString();
  const end        = range.end.toISOString();
  const monthLabel = formatMonthLabel(monthInput, start);

  try {

    let result;

    switch (mode) {

      case "FLOW":
        result = await getFlowReport({ start, end, outletIds, tenantId });
        if (result.error) throw result.error;
        await reply(chatId, formatFlowReport(result, monthLabel));
        break;

      case "DETAIL":
        result = await getDetailReport({ start, end, outletIds, tenantId });
        if (result.error) throw result.error;
        await reply(chatId, formatDetailReport(result, monthLabel));
        break;

      default:
        result = await getSummaryReport({ start, end, outletIds, tenantId });
        if (result.error) throw result.error;
        await reply(chatId, formatSummaryReport(result, monthLabel));
        break;
    }

  } catch (err) {
    console.log("REPORT ERROR:", err);
    await reply(chatId, "❌ REPORT ERROR");
  }

  return res.end();
}
