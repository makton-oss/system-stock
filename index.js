const express = require("express");
const { DateTime } = require("luxon");
const WebSocket = require("ws");
require("dotenv").config();

const supabase = require("./services/db");
const { end, handleDbError, deny, normalizeItem, safeQty, isLowStock } = require("./utils/helpers");
const { getRoleGuide, formatLowStockAlert, writeLog, getUserDisplay, formatLogDateTime, formatStock, formatPending, formatLogs, formatStaff, toProperCase, nowMY, ROLE_GUIDE, parseMonthInput, checkRole } = require("./utils/formatter");
const handlerMap = require("./core/handlerMap");
const { createContext } = require("./core/context");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// MIDDLEWARE
// ======================
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

// ======================
// WHATSAPP SENDER
// ======================
async function sendWhatsApp(phoneNumber, text) {
  try {
    const response = await fetch(process.env.BOTCOMMERCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

async function notifyManagers(text, outletId, excludeChatId = null) {

  const { data: rows, error } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .eq("role", "manager")
    .eq("outlet_id", outletId);

  if (error || !rows?.length) return;

  const targets = rows.filter(
    u => !excludeChatId || u.chat_id !== excludeChatId
  );

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

async function reply(chatId, text) {
  try {
    await sendWhatsApp(chatId, text);
  } catch (err) {
    console.error("REPLY ERROR:", err);
  }
}

// ======================
// WEBHOOK
// ======================
app.post("/webhook", async (req, res) => {

  let body = typeof req.body === "string"
    ? JSON.parse(req.body)
    : req.body || {};

  const chatId = (
    body.chat_id ||
    body.subscriber_id ||
    body.user_id ||
    ""
  ).split("-")[0];

  const { data: user } = await supabase
    .from("users")
    .select("*, outlets(name)")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (!user) return res.end();

  let message =
    body.user_message ||
    body.message ||
    body.text ||
    "";

  if (!message) return res.end();

  const parts = message.trim().split(/\s+/);
  const type = parts[0]?.toUpperCase();

  const handler = handlerMap[type];

  if (!handler) return res.end();

  const ctx = createContext({
    chatId,
    user,
    parts,
    res,
    reply
  });

  return handler(ctx);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});