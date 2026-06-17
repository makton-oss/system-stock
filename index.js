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