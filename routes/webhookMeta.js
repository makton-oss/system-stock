const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const handlerMap = require("../core/handlerMap");
const { createContext } = require("../core/context");
const { getUserByChatId } = require("../db/users/getUserByChatId");
const { checkUserRateLimit } = require("../utils/userRateLimit");
const { checkTenantRateLimit } = require("../utils/tenantRateLimit");
const { parseButtonMessage } = require("../utils/parseButtonMessage");
const { replyMeta } = require("../services/notification/reply");
const { Sentry } = require("../services/sentry");

// ======================
// RATE LIMITER
// ======================
const metaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log("META RATE LIMIT HIT:", req.ip);
    res.status(429).end();
  }
});

router.use(metaLimiter);

// ======================
// META WEBHOOK VERIFY (GET)
// ======================
router.get("/", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("META VERIFY HIT:", { mode, token, challenge });

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("✅ META WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  console.log("❌ META VERIFY FAILED — token mismatch atau mode salah");
  return res.status(403).end();
});

// ======================
// META WEBHOOK INCOMING (POST)
// ======================
router.post("/", async (req, res) => {

  res.status(200).end();

  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") return;

    const changes = body.entry?.[0]?.changes?.[0]?.value;
    if (!changes?.messages?.length) return;

    const msg    = changes.messages[0];
    const chatId = msg.from;

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

    console.log(`[META_IN] ${chatId} | type:${msg.type} | ${userMessage}`);
    const { logMessage } = require("../services/logging/messageLogger");
    await logMessage({ channel: "meta", direction: "in", chatId, message: userMessage, msgType: msg.type });

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
      const ctx = createContext({
        chatId,
        user,
        parts,
        message,
        res: { end: () => {} },
        reply: replyMeta,
        channel: "meta"
      });
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
      reply: replyMeta,
      channel: "meta"
    });

    await handler(ctx);

  } catch (err) {
    Sentry.captureException(err);
    console.error("META HANDLER ERROR:", err);
  }
});

module.exports = router;