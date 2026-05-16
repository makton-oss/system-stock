const { withRole } = require("../core/withRole");
const { getMainReport, getInventoryReport, getFlowReport, getDeadStock, getDetailReport } = require("../services/reportService");
const { formatMainReport, formatInventory, parseMonthInput } = require("../utils/formatter");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  // ======================
  // MODE DETECTION
  // ======================
  const mode = parts[1]?.toUpperCase();

  const COMMANDS = ["INVENTORY", "FLOW", "DEAD", "DETAIL"];

  // ======================
  // MONTH PARSE FIX
  // ======================
  let monthInput = "current";

  if (COMMANDS.includes(mode)) {
    // contoh: REPORT FLOW may-26
    monthInput = parts[2] || "current";
  } else {
    // contoh: REPORT may-26
    monthInput = parts[1] || "current";
  }

  const range = parseMonthInput(monthInput);

  if (!range) {
    await reply(chatId, "❌ FORMAT: REPORT may-26");
    return res.end();
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();

  // ======================
  // ROLE CONTROL
  // ======================
  const isAdmin = user.role === "admin";
  const outletId = isAdmin ? null : user.outlet_id;

  // ======================
  // ROUTING
  // ======================
  try {

    let result;

    switch (mode) {

      case "INVENTORY":
        result = await getInventoryReport({ outletId });

        if (result.error) throw result.error;

        await reply(chatId, formatInventory(result));
        return res.end();


      case "FLOW":
        result = await getFlowReport({ start, end, outletId });

        if (result.error) throw result.error;

        await reply(
          chatId,
          `💸 FLOW\nIN   RM ${result.inVal}\nOUT  RM ${result.outVal}\nNET  RM ${result.net}`
        );
        return res.end();


      case "DEAD":
        result = await getDeadStock({ outletId });

        if (result.error) throw result.error;

        if (!result.length) {
          await reply(chatId, "✅ TIADA DEAD STOCK");
          return res.end();
        }

        await reply(
          chatId,
          "💀 DEAD STOCK\n\n" +
          result.map(r => `• ${r.stock_items.name}`).join("\n")
        );
        return res.end();


      case "DETAIL":
        result = await getDetailReport({ start, end, outletId });

        if (result.error) throw result.error;

        if (!result.length) {
          await reply(chatId, "📭 TIADA DATA");
          return res.end();
        }

        await reply(
          chatId,
          "📊 DETAIL\n\n" +
          result.map(r =>
            `${r.name}\nIN: ${r.in} OUT: ${r.out}\n`
          ).join("\n")
        );
        return res.end();


      default:
        // MAIN REPORT
        result = await getMainReport({
          start,
          end,
          outletId,
          isAdmin
        });

        if (result.error) throw result.error;

        const monthLabel = monthInput.toUpperCase();

        await reply(
          chatId,
          formatMainReport(result, monthLabel)
        );

        return res.end();
    }

  } catch (err) {

    console.log("REPORT ERROR:", err);

    await reply(chatId, "❌ REPORT ERROR");
    return res.end();
  }
});