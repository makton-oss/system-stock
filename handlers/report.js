const { withRole } = require("../core/withRole");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");
const { getInventoryReport, getFlowReport, getDeadReport, getDetailReport } = require("../services/reportService");
const { getSummaryReport } = require("../services/reports/summaryReport");
const {
  formatSummaryReport,
  formatInventoryReport,
  formatDetailReport,
  formatDeadReport,
  formatFlowReport,
  parseMonthInput,
  formatMonthLabel
} = require("../utils/formatter");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const isAdmin = user.role === "admin";

  const outletIds = isAdmin
    ? null
    : await getAccessibleOutletIds(user);

  if (!isAdmin && !outletIds.length) {
    await reply(chatId, "❌ TIADA AKSES OUTLET");
    return res.end();
  }

  const REPORT_MODES = ["FLOW", "DEAD", "DETAIL", "INVENTORY"];
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
  // INVENTORY
  // ======================
  if (mode === "INVENTORY") {

    const rawDate = monthInput;
    const match   = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);

    if (!match) {
      await reply(chatId, "❌ FORMAT TARIKH: 30/04/26");
      return res.end();
    }

    const [, dd, mm, yy] = match;
    const snapshotDate   = `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;

    try {
      const result = await getInventoryReport({ outletIds, snapshotDate });
      if (result.error) throw result.error;

      // FIX: handle snapshot kosong
      if (!Object.keys(result).length) {
        await reply(chatId, `❌ TIADA SNAPSHOT UNTUK TARIKH: ${rawDate}\n\nSnapshot dijana setiap hari tengah malam. Pastikan tarikh betul.`);
        return res.end();
      }

      await reply(chatId, formatInventoryReport(result, rawDate));

    } catch (err) {
      console.log("INVENTORY REPORT ERROR:", err);
      await reply(chatId, "❌ REPORT ERROR");
    }

    return res.end();
  }

  // ======================
  // MONTH PARSE
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
        result = await getFlowReport({ start, end, outletIds });
        if (result.error) throw result.error;
        await reply(chatId, formatFlowReport(result, monthLabel));
        break;

      case "DEAD":
        // FIX: guna 60 hari ke belakang dari hari ini, bukan ikut bulan
        const deadEnd   = new Date().toISOString();
        const deadStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

        result = await getDeadReport({ start: deadStart, end: deadEnd, outletIds });
        if (result.error) throw result.error;

        const hasDead = Object.values(result).some(arr => arr.length);
        if (!hasDead) {
          await reply(chatId, "✅ TIADA STOCK YANG TIDAK BERGERAK 60 HARI SEBELUM INI.");
        } else {
          await reply(chatId, formatDeadReport(result, "60 Hari Lepas"));
        }
        break;

      case "DETAIL":
        result = await getDetailReport({ start, end, outletIds });
        if (result.error) throw result.error;

        const hasData = Object.values(result).some(arr => arr.length);
        if (!hasData) {
          await reply(chatId, "📭 TIADA DATA");
        } else {
          await reply(chatId, formatDetailReport(result, monthLabel));
        }
        break;

      default:
        result = await getSummaryReport({ start, end, outletIds });
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