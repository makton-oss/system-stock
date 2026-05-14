const express = require("express");
require("dotenv").config();

const supabase = require("./services/db");
const handlerMap = require("./core/handlerMap");
const { createContext } = require("./core/context");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

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

async function reply(chatId, text) {
  try {
    console.log("REPLY TO:", chatId, "|", text.slice(0, 50));
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

  if (!chatId) return res.end();

  // ======================
  // USER FETCH
  // ======================
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*, outlets(name)")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (userError) {
    console.log("USER FETCH ERROR:", userError);
    return res.end();
  }

  if (!user) return res.end();

  // ======================
  // MESSAGE PARSE
  // ======================
  let message =
    body.user_message ||
    body.message ||
    body.text ||
    "";

  if (!message) return res.end();

  const parts = message.trim().split(/\s+/);
  const type = parts[0]?.toUpperCase();

  if (!type) return res.end();

  const handler = handlerMap[type];

  if (!handler) return res.end();

  const ctx = createContext({
    chatId,
    user,
    parts,
    res,
    reply
  });

  try {
    return await handler(ctx);
  } catch (err) {
    console.error("HANDLER ERROR:", err);
    await reply(chatId, "❌ SYSTEM ERROR");
    return res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});