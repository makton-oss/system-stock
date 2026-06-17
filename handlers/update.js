const { withRole } = require("../core/withRole");
const { getManagersByTenant } = require("../db/users/getManagersByTenant");
const { sendWhatsApp } = require("../services/notification/whatsappService");
const { sendBatchMessages } = require("../utils/broadcast");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  let rawMessage = ctx.body.replace(/^update\s*/i, "").trim();
  let tenantId   = user.tenant_id || null;
  let tenantLabel = "";

  // ======================
  // SUPERADMIN: UPDATE @slug message → broadcast ke tenant specific
  // SUPERADMIN: UPDATE message       → broadcast ke SEMUA tenant
  // ADMIN:      UPDATE message       → broadcast ke tenant sendiri
  // ======================
  if (isSuperadmin && rawMessage.startsWith("@")) {

    const spaceIdx = rawMessage.indexOf(" ");

    if (spaceIdx === -1) {
      await reply(chatId, "❌ FORMAT: UPDATE @slug message");
      return res.end();
    }

    const slug = rawMessage.slice(1, spaceIdx);
    rawMessage  = rawMessage.slice(spaceIdx + 1).trim();

    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      await reply(chatId, `❌ TENANT TAK WUJUD: ${slug}`);
      return res.end();
    }

    tenantId    = tenant.id;
    tenantLabel = ` → ${slug}`;
  }

  if (!rawMessage) {
    await reply(chatId, isSuperadmin
      ? "❌ FORMAT: UPDATE message\nATAU: UPDATE @slug message"
      : "❌ FORMAT: UPDATE message"
    );
    return res.end();
  }

  // ======================
  // FETCH MANAGERS
  // ======================
  const { data: managers, error } = await getManagersByTenant(tenantId);

  if (error) {
    await reply(chatId, "❌ ERROR FETCH USER");
    return res.end();
  }

  if (!managers?.length) {
    await reply(chatId, "❌ TIADA MANAGER");
    return res.end();
  }

  // ======================
  // BROADCAST
  // ======================
  const { success, failed } = await sendBatchMessages(
    managers,
    `📢 SYSTEM UPDATE\n\n${rawMessage}`,
    sendWhatsApp,
    5,
    1000
  );

  await reply(chatId, `📢 UPDATE SENT${tenantLabel}\n\n✅ ${success} berjaya\n❌ ${failed} gagal`);
  return res.end();
});