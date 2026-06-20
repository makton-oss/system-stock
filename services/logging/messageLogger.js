const supabase = require("../db");

async function logMessage({ channel, direction, chatId, message, msgType = null }) {
  try {
    await supabase.from("message_logs").insert({
      channel,
      direction,
      chat_id: chatId,
      message,
      msg_type: msgType
    });
  } catch (err) {
    console.log("MESSAGE_LOG ERROR:", err);
  }
}

module.exports = { logMessage };