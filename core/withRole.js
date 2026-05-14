const { checkRole } = require("../utils/formatter");

function withRole(allowed, handler) {
  return async (ctx) => {
    const { chatId, reply, res } = ctx;

    const { ok } = await checkRole(chatId, allowed);

    if (!ok) {
      await reply(chatId, "❌ NO ACCESS");
      return res.end();
    }

    return handler(ctx);
  };
}

module.exports = { withRole };