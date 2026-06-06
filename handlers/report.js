const { withRole } = require("../core/withRole");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");
const { getInventoryReport, getFlowReport, getDeadReport, getDetailReport } = require("../services/reportService");
const { getSummaryReport } = require("../services/reports/summaryReport");
const { formatSummaryReport, formatInventoryReport, formatDetailReport, formatDeadReport, formatFlowReport, parseMonthInput, formatMonthLabel } = require("../utils/formatter");

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

    const monthInput = parts[2]?.toLowerCase() || "current";
    const range = parseMonthInput(monthInput);

    if (!range) {
      await reply(chatId, "❌ FORMAT: REPORT INVENTORY may-26");
      return res.end();
    }

    // last day of month as snapshot date
    const endDate = new Date(range.end);
    endDate.setDate(endDate.getDate() - 1);
    const snapshotDate = endDate.toISOString().split("T")[0]; // e.g. "2026-05-31"

    const monthLabel = formatMonthLabel(monthInput, range.start.toISOString());

    try {
      const result = await getInventoryReport({ outletIds, snapshotDate });
      if (result.error) throw result.error;

      if (!Object.keys(result).length) {
        await reply(chatId, `❌ TIADA SNAPSHOT UNTUK: ${monthLabel}\n\nSnapshot dijana setiap hari tengah malam.`);
        return res.end();
      }

      await reply(chatId, formatInventoryReport(result, monthLabel));

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
        result = await getDeadReport({ start, end, outletIds });
        if (result.error) throw result.error;

        const hasDead = Object.values(result).some(arr => arr.length);
        if (!hasDead) {
          await reply(chatId, `✅ TIADA DEAD STOCK - ${monthLabel}`);
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