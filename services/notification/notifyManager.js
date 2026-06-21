const { sendWhatsApp } = require("./whatsappService");
const { sendBatchMessages } = require("../../utils/broadcast");
const { getManagersByOutlet } = require("../../db/users/getManagersByOutlet");   // ✅ reuse, bukan query sendiri

async function notifyManagers(message, outletId, senderChatId = null, tenantId = null) {
  try {

    const recipients = await getManagersByOutlet(outletId, tenantId);   // ✅ manager + supervisor, tenant-scoped

    if (!recipients?.length) {
      console.log(`❌ NO MANAGER/SUPERVISOR FOR OUTLET: ${outletId}`);
      return;
    }

    const targets = recipients.filter(u => !senderChatId || u.chat_id !== senderChatId);

    if (!targets.length) return;

    await sendBatchMessages(targets, message, sendWhatsApp, 5, 500);

  } catch (err) {
    console.log("❌ NOTIFY MANAGER ERROR:", err);
  }
}

module.exports = { notifyManagers };