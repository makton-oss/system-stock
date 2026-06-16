function withRole(allowed, handler) {
  return async (ctx) => {
    const { chatId, user, reply, res } = ctx;

    // superadmin bypass semua role check
    if (user?.role === "superadmin") {
      return handler(ctx);
    }

    if (!user || !allowed.includes(user.role)) {
      await reply(chatId, "❌ NO ACCESS");
      return res.end();
    }

    return handler(ctx);
  };
}

module.exports = { withRole };