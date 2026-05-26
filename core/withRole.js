const { checkRole } = require("../utils/formatter");

// core/withRole.js — REPLACE

function withRole(allowed, handler) {
  return async (ctx) => {
    const { chatId, user, reply, res } = ctx;

    if (!user || !allowed.includes(user.role)) {
      await reply(chatId, "❌ NO ACCESS");
      return res.end();
    }

    return handler(ctx);
  };
}

module.exports = { withRole };