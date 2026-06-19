const express = require("express");
require("dotenv").config();
const rateLimit = require("express-rate-limit");
const startCronJobs = require("./src/jobs/startCronJobs");
const supabase = require("./services/db");
const handlerMap = require("./core/handlerMap");
const { createContext } = require("./core/context");
const { sendWhatsApp } = require("./services/notification/whatsappService");
const { parseButtonMessage } = require("./utils/parseButtonMessage");
const { getUserByChatId } = require("./db/users/getUserByChatId");
const { checkUserRateLimit } = require("./utils/userRateLimit");
const { checkTenantRateLimit } = require("./utils/tenantRateLimit");
const { gracefulShutdown, isShutdown } = require("./src/shutdown");
const { Sentry, initSentry } = require("./services/sentry");
const { sendWhatsAppMeta } = require("./services/notification/whatsappServiceMETA");


initSentry();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

// ======================
// REJECT REQUESTS DURING SHUTDOWN — selepas app init
// ======================
app.use((req, res, next) => {
  if (isShutdown()) return res.status(503).end();
  next();
})

// ======================
// GLOBAL RATE LIMIT
// ======================
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log("GLOBAL RATE LIMIT HIT:", req.ip);
    res.status(429).end();
  }
});

app.get("/health", (req, res) => {
  res.send("OK");
});

app.use(express.static("public"));

app.use("/webhook", globalLimiter);

startCronJobs();

// ======================
// META WEBHOOK VERIFY
// ======================
app.get("/webhook/meta", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("✅ META WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  return res.status(403).end();
});

// ======================
// META WEBHOOK INCOMING
// ======================
app.post("/webhook/meta", async (req, res) => {

  // Meta expects 200 fast — always ack first
  res.status(200).end();

  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") return;

    const changes = body.entry?.[0]?.changes?.[0]?.value;
    if (!changes?.messages?.length) return;

    const msg     = changes.messages[0];
    const chatId  = msg.from; // e.g. "60123456789"

    // ======================
    // PARSE MESSAGE TYPE
    // ======================
    let userMessage = "";

    if (msg.type === "text") {
      userMessage = msg.text?.body || "";
    } else if (msg.type === "interactive") {
      const iType = msg.interactive?.type;
      if (iType === "button_reply") {
        userMessage = msg.interactive.button_reply?.id || "";
      } else if (iType === "list_reply") {
        userMessage = msg.interactive.list_reply?.id || "";
      }
    }

    if (!userMessage) return;

    console.log("META MSG:", chatId, "|", userMessage);

    // ======================
    // REUSE EXISTING LOGIC
    // ======================
    const user = await getUserByChatId(chatId);
    if (!user) return;

    const { allowed } = checkUserRateLimit(chatId);
    if (!allowed) {
      await replyMeta(chatId, "⏳ Terlalu banyak request. Cuba lagi sebentar.");
      return;
    }

    const { allowed: tenantAllowed } = checkTenantRateLimit(user.tenant_id);
    if (!tenantAllowed) {
      await replyMeta(chatId, "⏳ Sistem sibuk. Cuba lagi sebentar.");
      return;
    }

    // Meta button postback tak ada "#Button Reply#" prefix
    // Tapi kita simulate supaya parseButtonMessage handle sama
    const rawMessage = msg.type === "interactive"
      ? `#Button Reply#${userMessage}`
      : userMessage;

    const message = await parseButtonMessage({
      raw: rawMessage,
      chatId,
      body: { reply_message_id: msg.context?.id || null },
      user
    });

    if (!message) return;

    const parts = message.trim().split(/\s+/);
    let type = parts[0]?.toUpperCase();

    if (type?.startsWith("APPROVE_ALL_")) type = "APPROVE";
    else if (type?.startsWith("REJECT_ALL_")) type = "REJECT";

    if (type === "REPORT" && parts.length === 1) {
      const handler = handlerMap.REPORTMENU;
      const ctx = createContext({ chatId, user, parts, message, res: { end: () => {} }, reply: replyMeta });
      return await handler(ctx);
    }

    const handler = handlerMap[type];
    if (!handler) {
      console.log("META NO HANDLER:", type);
      return;
    }

    const ctx = createContext({
      chatId,
      user,
      parts,
      message,
      res: { end: () => {} },
      reply: replyMeta
    });

    await handler(ctx);

  } catch (err) {
    Sentry.captureException(err);
    console.error("META HANDLER ERROR:", err);
  }
});

async function replyMeta(chatId, text) {
  try {
    console.log("META REPLY TO:", chatId, "|", text.slice(0, 50));
    await sendWhatsAppMeta(chatId, text);
  } catch (err) {
    console.error("META REPLY ERROR:", err);
  }
}


async function reply(chatId, text) {

  try {

    console.log(
      "REPLY TO:",
      chatId,
      "|",
      text.slice(0, 50)
    );

    await sendWhatsApp(chatId, text);

  } catch (err) {

    console.error("REPLY ERROR:", err);
  }
}

// ======================
// WEBHOOK
// ======================
app.post("/webhook", async (req, res) => {

  let body =
    typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

  console.log(
    "WEBHOOK BODY:",
    JSON.stringify(body, null, 2)
  );

  const rawId = (
    body.chat_id ||
    body.subscriber_id ||
    body.user_id ||
    ""
  ).split("-")[0];

  const chatId = rawId.replace(/[^\d]/g, "");

  if (!chatId) {
    return res.end();
  }

  // ======================
  // USER FETCH
  // ======================
  const user = await getUserByChatId(chatId);

  // ======================
  // FIX: was "if (userError)" — userError tidak wujud
  // getUserByChatId handle error internally, returns null
  // ======================
  if (!user) {
    return res.end();
  }

  // ======================
  // PER-USER RATE LIMIT
  // ======================
  const { allowed } = checkUserRateLimit(chatId);

  if (!allowed) {
    console.log("USER RATE LIMIT HIT:", chatId);
    await reply(chatId, "⏳ Terlalu banyak request. Cuba lagi sebentar.");
    return res.end();
  }

  // ======================
  // PER-TENANT RATE LIMIT
  // ======================
  const { allowed: tenantAllowed } = checkTenantRateLimit(user.tenant_id);

  if (!tenantAllowed) {
    console.log("TENANT RATE LIMIT HIT:", user.tenant_id);
    await reply(chatId, "⏳ Sistem sibuk. Cuba lagi sebentar.");
    return res.end();
  }

  // superadmin — tenant_id = null (bypass semua filter)
  const tenantId = user.tenant_id || null;

  // ======================
  // MESSAGE PARSE
  // ======================
  const message = await parseButtonMessage({
    raw: body.user_message || "",
    chatId,
    body,
    user
  });

  if (!message) {
    return res.end();
  }

  const parts =
    message
      .trim()
      .split(/\s+/);

  let type =
    parts[0]?.toUpperCase();

  // Fix for "APPROVE_ALL_" and "REJECT_ALL_"
  if (type?.startsWith("APPROVE_ALL_")) {
    type = "APPROVE";
  } else if (type?.startsWith("REJECT_ALL_")) {
    type = "REJECT";
  }

  // ======================
  // REPORT MENU
  // ======================
  if (type === "REPORT" && parts.length === 1) {

    const handler = handlerMap.REPORTMENU;

    const ctx = createContext({
      chatId,
      user,
      parts,
      body: message,
      res,
      reply
    });

    return await handler(ctx);
  }

  const handler = handlerMap[type];

  if (!handler) {

    console.log(
      "NO HANDLER:",
      type
    );

    return res.end();
  }

  const ctx = createContext({
    chatId,
    user,
    parts,
    message,
    res,
    reply
  });

  try {

    return await handler(ctx);

  } catch (err) {

    // ======================
    // CAPTURE TO SENTRY
    // ======================
    Sentry.captureException(err, {
      extra: {
        chatId,
        type,
        role: user?.role,
        tenant_id: user?.tenant_id
      }
    });

    console.error("HANDLER ERROR:", err);
    await reply(chatId, "❌ SYSTEM ERROR");
    return res.end();
  }
});

// ======================
// SERVER START
// ======================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ======================
// GRACEFUL SHUTDOWN — paling bawah sekali
// ======================
process.on("SIGTERM", () => gracefulShutdown(server));
process.on("SIGINT",  () => gracefulShutdown(server));