const { withRole } = require("../core/withRole");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getInventoryReport, getFlowReport, getDeadReport, getDetailReport } = require("../services/reportService");
const { getSummaryReport } = require("../services/reports/summaryReport");
const { getOwnerReport } = require("../services/reports/ownerSummary");
const { formatSummaryReport, formatInventoryReport, formatDetailReport, formatDeadReport, formatFlowReport, parseMonthInput, formatMonthLabel } = require("../utils/formatter");
const { formatOwnerReport } = require("../utils/formatters/ownerFormat");

module.exports = withRole(["manager", "owner", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const isAdmin     = user.role === "admin" || user.role === "superadmin";
  const tenantId    = user.tenant_id || null;
  const outletIds   = isAdmin
    ? null
    : await getAccessibleOutletIds(user);

  if (!isAdmin && !outletIds.length) {
    await reply(chatId, "❌ TIADA AKSES OUTLET");
    return res.end();
  }

  const REPORT_MODES = ["FLOW", "DEAD", "DETAIL", "INVENTORY", "COMPARE"];
  const first = parts[1]?.toUpperCase();

  let mode = null;
  let monthInput = "current";

  if (!first) {
    mode       = null;
    monthInput = "current";
  } else if (first === "SUMMARY") {
    mode       = null;
    monthInput = parts[2]?.toLowerCase() || "current";
  } else if (REPORT_MODES.includes(first)) {
    mode       = first;
    monthInput = parts[2] || "current";
  } else {
    mode       = null;
    monthInput = first.toLowerCase();
  }

  // ======================
  // COMPARE — OWNER ONLY
  // ======================
  if (mode === "COMPARE") {

    if (user.role !== "owner" && user.role !== "superadmin") {
      await reply(chatId, "❌ NO ACCESS");
      return res.end();
    }

    const ownerOutletIds = await getAccessibleOutletIds(user);
    const compareMode = parts[2] ? "monthly" : "dayrange";

    try {
      const result = await getOwnerReport({
        mode: compareMode,
        monthInput: parts[2],
        outletIds: ownerOutletIds,
        tenantId
      });

      if (result.error === "INVALID_MONTH") {
        await reply(chatId, "❌ FORMAT: REPORT COMPARE may-26");
        return res.end();
      }

      if (result.error) throw result.error;

      await reply(chatId, formatOwnerReport(result.data, result.label));

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

    const invMonthInput = parts[2]?.toLowerCase() || "current";
    const range = parseMonthInput(invMonthInput);

    if (!range) {
      await reply(chatId, "❌ FORMAT: REPORT INVENTORY may-26");
      return res.end();
    }

    // snapshot date = last day yang relevant (hari ini kalau day-range, last day bulan kalau whole-month)
    let snapshotDate;
    if (range.isDayRange) {
      snapshotDate = new Date(range.end).toISOString().split("T")[0];
    } else {
      const endDate = new Date(range.end);
      endDate.setDate(endDate.getDate() - 1);
      snapshotDate = endDate.toISOString().split("T")[0];
    }

    const monthLabel = formatMonthLabel(invMonthInput, range.start.toISOString());

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
  // DEAD STOCK — guna asOfDate, bukan start/end range
  // ======================
  if (mode === "DEAD") {

    const range = parseMonthInput(monthInput);

    if (!range) {
      await reply(chatId, "❌ FORMAT: REPORT DEAD may-26");
      return res.end();
    }

    const asOfDate = range.isDayRange
      ? new Date(range.end).toISOString()
      : new Date(new Date(range.end).getTime() - 1).toISOString(); // last moment of whole month

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
  // MONTH PARSE — FLOW / DETAIL / SUMMARY
  // ======================
  const range = parseMonthInput(monthInput);

  if (!range) {
    await reply(chatId, "❌ FORMAT: REPORT may-26");
    return res.end();
  }

  const start      = range.start.toISOString();
  const end        = range.end.toISOString();
  const monthLabel = formatMonthLabel(monthInput, start);

  // ======================
  // ROUTING
  // ======================
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
});