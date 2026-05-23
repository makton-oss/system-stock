const supabase = require("../db");
const { sendWhatsApp } = require("./whatsappService");

// ======================
// NOTIFY MANAGER
// ======================
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
      console.log(`❌ NO MANAGER MATCH OUTLET: ${outletId}`);
      return;
    }

    const targets = data
      .map(r => r.users.chat_id)
      .filter(id => !senderChatId || id !== senderChatId);

    const batchSize = 5;

    for (let i = 0; i < targets.length; i += batchSize) {

      const batch = targets.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(id => sendWhatsApp(id, message))
      );

      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          console.log("FAILED SEND:", batch[idx], r.reason);
        }
      });

      await new Promise(r => setTimeout(r, 500));
    }

  } catch (err) {
    console.log("❌ NOTIFY MANAGER ERROR:", err);
  }
}

module.exports = {
  notifyManagers
};