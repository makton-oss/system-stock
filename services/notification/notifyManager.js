const supabase = require("../db");
const { sendWhatsApp } = require("./whatsappService");
const { sendBatchMessages } = require("../../utils/broadcast");

async function notifyManagers(message, outletId, senderChatId = null) {
  try {

    const { data, error } = await supabase
      .from("user_outlets")
      .select(`
        outlet_id,
        users!inner(chat_id, role)
      `)
      .eq("outlet_id", outletId)
      .eq("users.role", "manager");

    if (error) {
      console.log("❌ FETCH MANAGER ERROR:", error);
      return;
    }

    if (!data?.length) {
      console.log(`❌ NO MANAGER FOR OUTLET: ${outletId}`);
      return;
    }

    const targets = data
      .map(r => ({ chat_id: r.users.chat_id }))
      .filter(u => !senderChatId || u.chat_id !== senderChatId);

    if (!targets.length) return;

    await sendBatchMessages(
      targets,
      message,
      sendWhatsApp,
      5,
      500
    );

  } catch (err) {
    console.log("❌ NOTIFY MANAGER ERROR:", err);
  }
}

module.exports = { notifyManagers };