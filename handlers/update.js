const { withRole } = require("../core/withRole");
const { getManagersByTenant } = require("../db/users/getManagersByTenant");
const { sendWhatsApp } = require("../services/notification/whatsappService");
const { sendBatchMessages } = require("../utils/broadcast");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  const message = ctx.body.replace(/^update\s*/i, "").trim();

  if (!message) {
    await reply(chatId, "❌ FORMAT: UPDATE message");
    return res.end();
  }

  const { data: managers, error } = await getManagersByTenant(tenantId);

  if (error) {
    await reply(chatId, "❌ ERROR FETCH USER");
    return res.end();
  }

  if (!managers?.length) {
    await reply(chatId, "❌ TIADA MANAGER");
    return res.end();
  }

  const { success, failed } = await sendBatchMessages(
    managers,
    `📢 SYSTEM UPDATE\n\n${message}`,
    sendWhatsApp,
    5,
    1000
  );

  await reply(chatId, `📢 UPDATE SENT\n\n✅ ${success} berjaya\n❌ ${failed} gagal`);
  return res.end();
});