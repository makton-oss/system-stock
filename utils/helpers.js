const fetch = require("node-fetch");
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

    if (!response.ok) {
      const errText = await response.text();
      console.log("BOTCOMMERCE ERROR:", errText);
      throw new Error(errText);
    }

  } catch (err) {
    console.log("SEND FAIL:", err);
  }
}

// ======================
// NOTIFY MANAGER
// ======================
async function notifyManagers(text, outletId, excludeChatId = null) {

  const { data: rows, error } = await supabase
    .from("users")
    .select("chat_id")
    .eq("role", "manager")
    .eq("outlet_id", outletId);

  if (error || !rows?.length) return;

  const targets = rows.filter(
    u => !excludeChatId || u.chat_id !== excludeChatId
  );

  const batchSize = 5;

  for (let i = 0; i < targets.length; i += batchSize) {

    const batch = targets.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(u => sendWhatsApp(u.chat_id, text))
    );

    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = {
  normalizeItem,
  safeQty,
  sendWhatsApp,
  notifyManagers
};