const { withRole } = require("../core/withRole");
const { getOutletByCode } = require("../db/outlets/getOutletByCode");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");
const { removeUserOutletLink } = require("../db/users/removeUserOutletLink");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  if (parts.length < 3) {
    await reply(chatId, "❌ FORMAT: REMOVEOUTLET 60123456789 outletname");
    return res.end();
  }

  const phone      = parts[1];
  const outletName = parts.slice(2).join(" ");

  const outlet = await getOutletByCode(outletName, tenantId);
  if (!outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  const targetUser = await verifyUserInTenant(phone, tenantId);
  if (!targetUser) {
    await reply(chatId, "❌ USER TAK WUJUD DALAM TENANT");
    return res.end();
  }

  const { error } = await removeUserOutletLink(phone, outlet.id);
  if (error) {
    await reply(chatId, "❌ ERROR REMOVE OUTLET");
    return res.end();
  }

  await reply(chatId, `✅ OUTLET ${outlet.name} DIBUANG DARI ${phone}`);
  return res.end();
});