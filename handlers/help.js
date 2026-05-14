const { getRoleGuide, checkRole } = require("../utils/formatter");

module.exports = async (ctx) => {
  const { chatId, reply, res } = ctx;

  const { role } = await checkRole(chatId, ["staff","manager","admin"]);

  await reply(chatId, getRoleGuide(role));
  return res.end();
};