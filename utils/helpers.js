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

  console.log("==== NOTIFY START ====");
  console.log("OUTLET INPUT:", outletId, typeof outletId);

  const { data: rows, error } = await supabase
    .from("users")
    .select("chat_id, outlet_id, role")
    .eq("role", "manager");

  if (error) {
    console.log("NOTIFY FETCH ERROR:", error);
    return;
  }

  console.log("ALL MANAGERS:", rows);

  if (!rows?.length) {
    console.log("NO MANAGERS IN DB");
    return;
  }

  const targets = rows.filter(u => {
    console.log("COMPARE:", u.outlet_id, typeof u.outlet_id);

    return (
      String(u.outlet_id).trim() === String(outletId).trim() &&
      (!excludeChatId || u.chat_id !== excludeChatId)
    );
  });

  console.log("MATCHED:", targets);

  if (!targets.length) {
    console.log("❌ NO MANAGER MATCH OUTLET:", outletId);
    return;
  }

  for (const u of targets) {
    console.log("SENDING TO:", u.chat_id);
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

  console.log("==== NOTIFY END ====");
}

module.exports = {
  normalizeItem,
  safeQty,
  sendWhatsApp,
  notifyManagers
};