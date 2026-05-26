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

  // ======================
  // OUTLET ACCESS
  // ======================
  const outletIds = isAdmin
    ? null
    : await getAccessibleOutletIds(user);

  if (!isAdmin && !outletIds.length) {
    await reply(chatId, "❌ TIADA AKSES OUTLET");
    return res.end();
  }

  // ======================
  // MODE + MONTH DETECTION
  // ======================
  const REPORT_MODES = ["FLOW", "DEAD", "DETAIL", "INVENTORY"];
  const first = parts[1]?.toUpperCase();

  let mode = null;
  let monthInput = "current";

  if (!first) {
    // REPORT sahaja → summary current
    mode = null;
    monthInput = "current";

  } else if (first === "SUMMARY") {
    // REPORT SUMMARY may-26
    mode = null;
    monthInput = parts[2]?.toLowerCase() || "current";

  } else if (REPORT_MODES.includes(first)) {
    // REPORT FLOW may-26
    // REPORT INVENTORY 30/04/26
    mode = first;
    monthInput = parts[2] || "current";

  } else {
    // REPORT may-26 (shortcut summary)
    mode = null;
    monthInput = first.toLowerCase();
  }

  // ======================
  // INVENTORY (special flow)
  // ======================
  if (mode === "INVENTORY") {

    const rawDate = monthInput;

    const match = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);

    if (!match) {
      await reply(chatId, "❌ FORMAT TARIKH: 30/04/26");
      return res.end();
    }

    const [, dd, mm, yy] = match;
    const snapshotDate = `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;

    try {
      const result = await getInventoryReport({ outletIds, snapshotDate });

      if (result.error) throw result.error;

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

  const start = range.start.toISOString();
  const end = range.end.toISOString();
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
        result = await getDeadReport({ start, end, outletIds });
        if (result.error) throw result.error;

        const hasDead = Object.values(result).some(arr => arr.length);
        if (!hasDead) {
          await reply(chatId, "✅ TIADA STOCK YANG TIDAK BERGERAK 60 HARI SEBELUM INI.");
        } else {
          await reply(chatId, formatDeadReport(result, monthLabel));
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
        // SUMMARY
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