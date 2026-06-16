const { withRole } = require("../core/withRole");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");
const { setUserActive } = require("../db/users/setUserActive");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  if (parts.length < 2) {
    await reply(chatId, "❌ FORMAT: REMOVEROLE 60123456789");
    return res.end();
  }

  const phone = parts[1];

  const targetUser = await verifyUserInTenant(phone, tenantId);
  if (!targetUser) {
    await reply(chatId, "❌ USER TAK WUJUD DALAM TENANT");
    return res.end();
  }

  const { error } = await setUserActive(phone, false);
  if (error) {
    await reply(chatId, "❌ ERROR REMOVE ROLE");
    return res.end();
  }

  await reply(chatId, "✅ USER DINYAHAKTIFKAN");
  return res.end();
});