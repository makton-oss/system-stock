const { sendWhatsApp }  = require("./whatsappService");
const { sendTelegram }  = require("./telegramService");
const { sendButtonsRouter } = require("./notificationRouter");
const { getManagersByOutlet } = require("../../db/users/getManagersByOutlet");

async function notifyManagers(message, outletId, senderChatId = null, tenantId = null, channel = "botcommerce") {
  try {
    const recipients = await getManagersByOutlet(outletId, tenantId);

    if (!recipients?.length) {
      console.log(`❌ NO MANAGER/SUPERVISOR FOR OUTLET: ${outletId}`);
      return;
    }

    for (const u of recipients) {
      if (senderChatId && u.chat_id === senderChatId) continue;

      // resolve target ID based on channel
      const targetId = channel === "telegram"
        ? u.telegram_chat_id
        : u.chat_id;

      if (!targetId) {
        console.log(`⚠️ NO ${channel.toUpperCase()} ID FOR:`, u.chat_id);
        continue;
      }

      try {
        if (channel === "telegram") {
          await sendTelegram(targetId, message);
        } else if (channel === "meta") {
          const { sendWhatsAppMeta } = require("./whatsappServiceMETA");
          await sendWhatsAppMeta(targetId, message);
        } else {
          await sendWhatsApp(targetId, message);
        }
      } catch (err) {
        console.log(`NOTIFY ${channel.toUpperCase()} ERROR:`, targetId, err);
      }
    }

  } catch (err) {
    console.log("❌ NOTIFY MANAGER ERROR:", err);
  }
}

module.exports = { notifyManagers };