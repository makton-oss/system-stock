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
      return;
    }

    // 🔥 OPTIONAL: kalau API return JSON status
    try {
      const json = JSON.parse(resText);

      if (json.status !== "1") {
		  console.log("❌ API LOGIC FAIL:", json);
		  return { ok: false };
		}
	  return { ok: false };

    } catch {
      // ignore kalau bukan JSON
	  return { ok: false };
    }

  } catch (err) {
    console.log("❌ SEND FAIL:", err);
	return { ok: false };
  }
}

// ======================
// NOTIFY MANAGER
// ======================
async function notifyManagers(text, outletId, excludeChatId = null) {
  const { data: rows, error } = await supabase
    .from("users")
    .select("chat_id, outlet_id, role")
    .eq("role", "manager");

  if (error) {
    console.log("NOTIFY FETCH ERROR:", error);
    return;
  }

  if (!rows?.length) {
    console.log("NO MANAGERS IN DB");
    return;
  }

  const targets = rows.filter(u => {
    return (
      String(u.outlet_id).trim() === String(outletId).trim() &&
      (!excludeChatId || u.chat_id !== excludeChatId)
    );
  });

  if (!targets.length) {
    console.log("❌ NO MANAGER MATCH OUTLET:", outletId);
    return;
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