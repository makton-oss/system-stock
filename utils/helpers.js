const supabase = require("../services/db");
const { sendButtons } = require("./sendButtons");
const { getManagersByOutlet } = require("./getManagersByOutlet");
const { toProperCase } = require("./formatter");

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

  const { data } = await supabase
    .from("user_outlet")
    .select("users(chat_id, role)")
    .eq("outlet_id", outletId);

  const managers = data
    ?.filter(x => x.users.role === "manager")
    ?.map(x => x.users);

  if (!managers?.length) {
    console.log("❌ NO MANAGER MATCH OUTLET:", outletId);
    return;
  }

  for (let m of managers) {
    await sendButtons(m.chat_id, text, buttons);
  }
}

// ======================
// NOTIFY SMART
// ======================
async function notifySmartStock(outletId, latestRequest) {

  console.log("NOTIFY OUTLET:", outletId);
  console.log("LATEST REQUEST:", latestRequest);
  const { data: rows } = await supabase
    .from("requests")
    .select(`
	  id,
	  item,
	  qty,
	  type,
	  created_at,
	  requested_by,
	  outlets(name),
	  users(nickname, chat_id)
	`)
    .eq("status", "pending")
    .eq("outlet_id", outletId);

  if (!rows?.length) return;

  console.log(
    "REQUEST OUTLETS:",
    rows.map(x => ({
      id: x.id,
      item: x.item,
      outlet: x.outlets?.name
    }))
  );

  console.log("SMART STOCK TRIGGER:", outletId, latestRequest);

  const managers = await getManagersByOutlet(outletId);

  // ======================
  // SINGLE
  // ======================
  if (rows.length === 1) {

    const r = rows[0];

    const text = `📥 STOCK ${r.type.toUpperCase()} - ${r.outlets?.name || "-"}

ID ${r.id} ${r.item} x${r.qty}
BY: ${r.users?.nickname || "-"} (${r.requested_by})`

    for (let m of managers) {
      await sendButtons(
        m.chat_id,
        text,
        [
          { id: `APPROVE ${r.id}`, title: `Approve` },
          { id: `REJECT ${r.id}`, title: `Reject` }
        ]
      );
    }

    return;
  }

  // ======================
  // MULTI STACK
  // ======================

  rows.sort((a, b) => {
    if (a.type !== b.type) return a.type === "in" ? -1 : 1;
    if (a.requested_by !== b.requested_by) return a.requested_by.localeCompare(b.requested_by);
    return new Date(a.created_at) - new Date(b.created_at);
  });
  
  const { data: outlet } = await supabase
	  .from("outlets")
	  .select("name")
	  .eq("id", outletId)
	  .maybeSingle();

	let text = `📦 STOCK REQUEST - ${toProperCase(outlet?.name || "-")}\n\n`;

  let currentType = null;
  let currentUser = null;

  for (let r of rows) {

    if (currentType !== r.type) {
      text += r.type === "in" ? "📥 IN\n" : "\n📤 OUT\n";
      currentType = r.type;
      currentUser = null;
    }

    if (currentUser !== r.requested_by) {

	  const { data: reqUser } = await supabase
		.from("users")
		.select("nickname, chat_id")
		.eq("chat_id", r.requested_by)
		.maybeSingle();

	  const displayName =
		reqUser?.nickname || r.requested_by;

	  const displayPhone =
		reqUser?.chat_id || r.requested_by;

	  text += `BY: ${toProperCase(displayName)} (${displayPhone})\n`;

	  currentUser = r.requested_by;
	}

    text += `ID ${r.id} ${r.item} x${r.qty}\n`;
  }

  for (let m of managers) {

	  const sent = await sendButtons(
		m.chat_id,
		text,
		[
      {
      id: `APPROVE_ALL_${outletId}`,
      title: `APPROVE_ALL_${outletId}`
      },
      {
      id: `REJECT_ALL_${outletId}`,
      title: `REJECT_ALL_${outletId}`
      }
    ]
	  );

	  if (!sent.ok) {
		console.log("SKIP MANAGER:", m.chat_id);
	  }
	}
}

module.exports = {
  normalizeItem,
  safeQty,
  sendWhatsApp,
  notifyManagers,
  notifyManagersWithButtons,
  notifySmartStock,
  sendMessage: sendWhatsApp
};