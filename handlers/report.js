const { withRole } = require("../core/withRole");
const { getMainReport, getInventoryReport, getFlowReport, getDeadStock, getDetailReport } = require("../services/reportService");
const { formatMainReport, formatInventory, parseMonthInput } = require("../utils/formatter");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const mode = parts[1]?.toUpperCase();
  const isAdmin = user.role === "admin";

  const outletId = isAdmin ? null : user.outlet_id;

  const range = parseMonthInput(parts[2] || parts[1] || "current");

  if (!range) {
    await reply(chatId, "❌ FORMAT");
    return res.end();
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();

  let result;

  switch (mode) {

    case "INVENTORY":
      result = await getInventoryReport({ outletId });
      await reply(chatId, formatInventory(result));
      return res.end();

    case "FLOW":
      result = await getFlowReport({ start, end, outletId });
      await reply(chatId,
        `💸 FLOW\nIN ${result.inVal}\nOUT ${result.outVal}\nNET ${result.net}`
      );
      return res.end();

    case "DEAD":
      result = await getDeadStock({ outletId });
      await reply(chatId,
        "💀 DEAD\n" + result.map(r => r.stock_items.name).join("\n")
      );
      return res.end();

    case "DETAIL":
      result = await getDetailReport({ start, end, outletId });
      await reply(chatId,
        result.map(r => `${r.name} IN:${r.in} OUT:${r.out}`).join("\n")
      );
      return res.end();

    default:
      result = await getMainReport({ start, end, outletId });
      await reply(chatId, formatMainReport(result));
      return res.end();
  }
});