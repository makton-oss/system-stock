const { withRole } = require("../core/withRole");
const { linkTelegramId } = require("../db/users/getTelegramUser");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  // FORMAT: SETTELEGRAM 60123456789 telegram_id
  if (parts.length < 3) {
    await reply(chatId, isSuperadmin
      ? "❌ FORMAT: SETTELEGRAM 60123456789@slug telegram_id"
      : "❌ FORMAT: SETTELEGRAM 60123456789 telegram_id"
    );
    return res.end();
  }

  const { cleanValue: phone, tenantId, error: slugError } = await parseSuperadminTarget(
    parts[1],
    isSuperadmin,
    user.tenant_id || null
  );

  if (slugError) {
    await reply(chatId, slugError);
    return res.end();
  }

  const telegramId = parts[2];

  const targetUser = await verifyUserInTenant(phone, tenantId);
  if (!targetUser) {
    await reply(chatId, "❌ USER TAK WUJUD DALAM TENANT");
    return res.end();
  }

  const { error } = await linkTelegramId(phone, telegramId);
  if (error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  await reply(chatId, `✅ Telegram ID berjaya dikaitkan dengan ${phone}`);
  return res.end();
});