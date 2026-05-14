const { withRole } = require("../core/withRole");
const { generateReport } = require("../services/reportService");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const monthInput = parts[1] || "current";

  const result = await generateReport(
    monthInput,
    user.outlet_id
  );

  if (result.error === "INVALID_FORMAT") {
    await reply(chatId, "❌ FORMAT: REPORT feb-26");
    return res.end();
  }

  if (result.error) {
    await reply(chatId, "❌ REPORT ERROR");
    return res.end();
  }

  await reply(chatId, result.text);
  return res.end();
});