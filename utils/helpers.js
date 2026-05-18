const supabase = require("../services/db");
const { sendButtons } = require("./sendButtons");

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

// ======================
// NOTIFY MANAGER BUTTONS
// ======================
async function notifyManagersWithButtons(text, outletId, buttons) {

  const { data: managers } = await supabase
    .from("users")
    .select("chat_id")
    .eq("role", "manager")
    .eq("outlet_id", outletId);

  if (!managers?.length) {
    console.log("❌ NO MANAGER");
    return;
  }

  for (let m of managers) {
    await sendButtons(m.chat_id, text, buttons);
  }
}

module.exports = { notifyManagersWithButtons };

module.exports = {
  normalizeItem,
  safeQty,
  sendWhatsApp,
  notifyManagers,
  notifyManagersWithButtons,
  sendMessage: sendWhatsApp
};