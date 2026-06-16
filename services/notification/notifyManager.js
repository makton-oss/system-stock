const supabase = require("../db");
const { sendWhatsApp } = require("./whatsappService");
const { sendBatchMessages } = require("../../utils/broadcast");

async function notifyManagers(message, outletId, senderChatId = null, tenantId = null) {
  try {

    let q = supabase
      .from("outlet_access")  // ✅ fix: user_outlets → outlet_access
      .select(`
        outlet_id,
        users!inner(chat_id, role, tenant_id)
      `)
      .eq("outlet_id", outletId)
      .eq("users.role", "manager");

    if (tenantId) {
      q = q.eq("users.tenant_id", tenantId);
    }

    const { data, error } = await q;

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

    await sendBatchMessages(targets, message, sendWhatsApp, 5, 500);

  } catch (err) {
    console.log("❌ NOTIFY MANAGER ERROR:", err);
  }
}

module.exports = { notifyManagers };