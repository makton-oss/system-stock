const { withRole } = require("../core/withRole");
const { getOutletByCode } = require("../db/outlets/getOutletByCode");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");
const { removeUserOutletLink } = require("../db/users/removeUserOutletLink");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  if (parts.length < 3) {
    await reply(chatId, isSuperadmin
      ? "❌ FORMAT: REMOVEOUTLET 60123456789 outletname@slug"
      : "❌ FORMAT: REMOVEOUTLET 60123456789 outletname"
    );
    return res.end();
  }

  const phone    = parts[1];
  const rawOutlet = parts.slice(2).join(" ");

  // Parse outlet + @slug (superadmin sahaja)
  const { cleanValue: outletName, tenantId, error } = await parseSuperadminTarget(
    rawOutlet,
    isSuperadmin,
    user.tenant_id || null
  );

  if (error) {
    await reply(chatId, error);
    return res.end();
  }

  const outlet = await getOutletByCode(outletName, tenantId);
  if (!outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  // Verify user dalam tenant yang sama dengan outlet
  const targetUser = await verifyUserInTenant(phone, tenantId);
  if (!targetUser) {
    await reply(chatId, "❌ USER TAK WUJUD DALAM TENANT");
    return res.end();
  }

  const { error: removeError } = await removeUserOutletLink(phone, outlet.id);
  if (removeError) {
    await reply(chatId, "❌ ERROR REMOVE OUTLET");
    return res.end();
  }

  await reply(chatId, `✅ OUTLET ${outlet.name} DIBUANG DARI ${phone}`);
  return res.end();
});