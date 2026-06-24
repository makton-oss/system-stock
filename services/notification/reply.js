const { sendWhatsApp }     = require("./whatsappService");
const { sendWhatsAppMeta } = require("./whatsappServiceMETA");
const { logMessage }       = require("../logging/messageLogger");

async function reply(chatId, text) {
  try {
    console.log("REPLY TO:", chatId, "|", text.slice(0, 50));
    await sendWhatsApp(chatId, text);
  } catch (err) {
    console.error("REPLY ERROR:", err);
  }
}

async function replyMeta(chatId, text) {
  try {
    console.log(`[META_OUT] ${chatId} | ${text}`);
    await logMessage({ channel: "meta", direction: "out", chatId, message: text });
    await sendWhatsAppMeta(chatId, text);
  } catch (err) {
    console.error(`[META_OUT_ERROR] ${chatId}`, err);
  }
}

module.exports = { reply, replyMeta };