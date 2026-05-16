const { withRole } = require("../core/withRole");

const {
  getInventory,
  getDetail,
  getDead,
  getFlow
} = require("../services/reportService");

const {
  formatInventoryReport,
  formatDetailReport,
  formatDeadReport,
  formatFlowReport,
  parseMonthInput
} = require("../utils/formatter");

module.exports = withRole(["manager","admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const mode = parts[1]?.toUpperCase();
  const COMMANDS = ["INVENTORY","DETAIL","DEAD","FLOW"];

  let monthInput = "current";

  if (COMMANDS.includes(mode)) {
    monthInput = parts[2] || "current";
  } else {
    monthInput = parts[1] || "current";
  }

  const range = parseMonthInput(monthInput);

  if (!range) {
    await reply(chatId, "❌ FORMAT");
    return res.end();
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();

  const outletId =
    user.role === "admin" ? null : user.outlet_id;

  let result;

  switch(mode){

    case "INVENTORY":
      result = await getInventory({ outletId });
      await reply(chatId, formatInventoryReport(result, monthInput.toUpperCase()));
      return res.end();

    case "DETAIL":
      result = await getDetail({ start, end, outletId });
      await reply(chatId, formatDetailReport(result, monthInput.toUpperCase()));
      return res.end();

    case "DEAD":
      result = await getDead({ start, end, outletId });
      await reply(chatId, formatDeadReport(result, monthInput.toUpperCase()));
      return res.end();

    case "FLOW":
      result = await getFlow({ start, end, outletId });
      await reply(chatId, formatFlowReport(result, monthInput.toUpperCase()));
      return res.end();

    default:
      await reply(chatId, "Gunakan: REPORT INVENTORY / DETAIL / DEAD / FLOW");
      return res.end();
  }
});