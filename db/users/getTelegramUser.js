const supabase = require("../../services/db");

async function getUserByTelegramId(telegramChatId) {
  const { data, error } = await supabase
    .from("users")
    .select("*, outlets(name)")
    .eq("telegram_chat_id", String(telegramChatId))
    .eq("is_active", true)
    .maybeSingle();

  if (error) console.log("GET_TELEGRAM_USER ERROR:", error);
  return data || null;
}

async function linkTelegramId(phone, telegramChatId) {
  const { error } = await supabase
    .from("users")
    .update({ telegram_chat_id: String(telegramChatId) })
    .eq("chat_id", phone);

  if (error) console.log("LINK_TELEGRAM_ID ERROR:", error);
  return { error };
}

async function savePendingLink(telegramChatId) {
  const { error } = await supabase
    .from("telegram_pending_links")
    .upsert({
      telegram_chat_id: String(telegramChatId),
      created_at: new Date().toISOString()
    }, { onConflict: "telegram_chat_id" });

  if (error) console.log("SAVE_PENDING_LINK ERROR:", error);
  return { error };
}

async function deletePendingLink(telegramChatId) {
  await supabase
    .from("telegram_pending_links")
    .delete()
    .eq("telegram_chat_id", String(telegramChatId));
}

module.exports = {
  getUserByTelegramId,
  linkTelegramId,
  savePendingLink,
  deletePendingLink
};