const { getUserByChatId } = require("../db/users/getUserByChatId");

// ⚠️ TEMP AUTH — chat_id only, NO password/token.
// Anyone who knows an admin/owner/superadmin's chat_id can access this
// dashboard. Replace with token or OTP layer BEFORE production use.
async function requireDashboardUser(req, res, next) {

  const chatId = req.query.chat_id || req.body?.chat_id;

  if (!chatId) {
    return res.status(401).json({ error: "chat_id diperlukan" });
  }

  const user = await getUserByChatId(chatId); // tenantId=null → global lookup

  if (!user) {
    return res.status(403).json({ error: "USER TAK WUJUD / TIDAK AKTIF" });
  }

  if (!["admin", "owner", "superadmin"].includes(user.role)) {
    return res.status(403).json({ error: "NO ACCESS — bukan admin/owner/superadmin" });
  }

  req.dashboardUser = user;
  next();
}

module.exports = { requireDashboardUser };