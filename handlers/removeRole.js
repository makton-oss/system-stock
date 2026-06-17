const { withRole } = require("../core/withRole");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");
const { setUserActive } = require("../db/users/setUserActive");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  if (parts.length < 2) {
    await reply(chatId, isSuperadmin
      ? "❌ FORMAT: REMOVEROLE 60123456789@slug"
      : "❌ FORMAT: REMOVEROLE 60123456789"
    );
    return res.end();
  }

  // Parse phone + @slug (superadmin sahaja)
  const { cleanValue: phone, tenantId, error } = await parseSuperadminTarget(
    parts[1],
    isSuperadmin,
    user.tenant_id || null
  );

  if (error) {
    await reply(chatId, error);
    return res.end();
  }

  const targetUser = await verifyUserInTenant(phone, tenantId);
  if (!targetUser) {
    await reply(chatId, "❌ USER TAK WUJUD DALAM TENANT");
    return res.end();
  }

  const { error: updateError } = await setUserActive(phone, false);
  if (updateError) {
    await reply(chatId, "❌ ERROR REMOVE ROLE");
    return res.end();
  }

  await reply(chatId, "✅ USER DINYAHAKTIFKAN");
  return res.end();
});