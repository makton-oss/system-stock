const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { sendWhatsApp } = require("../services/notification/WhatsappService");
const { sendBatchMessages } = require("../utils/broadcast");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, reply, body, res } = ctx;

  const message = ctx.body.replace(/^update\s*/i, "").trim();

  if (!message) {
    await reply(chatId, "❌ FORMAT: UPDATE message");
    return res.end();
  }

  // ======================
  // GET MANAGERS
  // ======================
  const { data: managers, error } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .eq("role", "manager");

  if (error) {
    console.log("UPDATE ERROR:", error);
    await reply(chatId, "❌ ERROR FETCH USER");
    return res.end();
  }

  if (!managers?.length) {
    await reply(chatId, "❌ TIADA MANAGER");
    return res.end();
  }
  
  // ======================
  // SEND (BATCH)
  // ======================
  const { success, failed } = await sendBatchMessages(
    managers,
    `📢 SYSTEM UPDATE\n\n${message}`,
    sendMessage,
    5,       // batch size
    1000     // delay ms
  );

  // ======================
  // RESULT
  // ======================
  await reply(
    chatId,
    `📢 UPDATE SENT\n\n✅ ${success} berjaya\n❌ ${failed} gagal`
  );

  return res.end();
});