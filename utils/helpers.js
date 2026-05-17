const supabase = require("../services/db");

// ======================
// ITEM NORMALIZER
// ======================

function normalizeItem(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

// ======================
// SAFE INTEGER
// ======================
function safeQty(value) {

  const qty = parseInt(value);

  if (isNaN(qty) || qty <= 0) {
    return null;
  }

  return qty;
}

// ======================
// WHATSAPP SENDER
// ======================
async function sendWhatsApp(phoneNumber, text) {
  try {
    const response = await fetch(process.env.BOTCOMMERCE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiToken: process.env.BOTCOMMERCE_API,
        phone_number_id: process.env.PHONE_NUMBER_ID,
        phone_number: phoneNumber,
        message: text
      })
    });

    const resText = await response.text();

    if (!response.ok) {
      console.log("❌ HTTP ERROR:", resText);
      return { ok: false };
    }

    try {
      const json = JSON.parse(resText);

      if (json.status !== "1") {

		  if (json.message?.includes("24 hour")) {
			return { ok: false, reason: "24h_window" };
		  }

		  return { ok: false };
		}

      return { ok: true };

    } catch {
      return { ok: true };
    }

  } catch (err) {
    console.log("❌ SEND FAIL:", err);
    return { ok: false };
  }
}

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

    // extract chat_id
    const chatIds = data.map(r => r.users.chat_id);

    for (const id of chatIds) {

      // optional: skip sender (kalau manager sendiri trigger)
      if (senderChatId && id === senderChatId) continue;

      await sendWhatsApp(id, message);
    }

  } catch (err) {
    console.log("❌ NOTIFY MANAGER ERROR:", err);
  }

  const batchSize = 5;

  for (let i = 0; i < targets.length; i += batchSize) {

    const batch = targets.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(u => sendWhatsApp(u.chat_id, text))
    );

    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.log("FAILED SEND:", batch[idx].chat_id, r.reason);
      }
    });

    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = {
  normalizeItem,
  safeQty,
  sendWhatsApp,
  notifyManagers,
  sendMessage: sendWhatsApp
};