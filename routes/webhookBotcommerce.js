const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const handlerMap = require("../core/handlerMap");
const { createContext } = require("../core/context");
const { getUserByChatId } = require("../db/users/getUserByChatId");
const { checkUserRateLimit } = require("../utils/userRateLimit");
const { checkTenantRateLimit } = require("../utils/tenantRateLimit");
const { parseButtonMessage } = require("../utils/parseButtonMessage");
const { reply } = require("../services/notification/reply");
const { Sentry } = require("../services/sentry");

// ======================
// GLOBAL RATE LIMIT — khusus /webhook botcommerce
// Diletak sebagai route-level middleware (bukan router.use) supaya
// scoped tepat kat POST "/" je, tak bocor ke path lain.
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

router.post("/", globalLimiter, async (req, res) => {

  let body =
    typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

  console.log("WEBHOOK BODY:", JSON.stringify(body, null, 2));

  const rawId = (
    body.chat_id ||
    body.subscriber_id ||
    body.user_id ||
    ""
  ).split("-")[0];

  const chatId = rawId.replace(/[^\d]/g, "");

  if (!chatId) return res.end();

  const user = await getUserByChatId(chatId);
  if (!user) return res.end();

  const { allowed } = checkUserRateLimit(chatId);
  if (!allowed) {
    console.log("USER RATE LIMIT HIT:", chatId);
    await reply(chatId, "⏳ Terlalu banyak request. Cuba lagi sebentar.");
    return res.end();
  }

  const { allowed: tenantAllowed } = checkTenantRateLimit(user.tenant_id);
  if (!tenantAllowed) {
    console.log("TENANT RATE LIMIT HIT:", user.tenant_id);
    await reply(chatId, "⏳ Sistem sibuk. Cuba lagi sebentar.");
    return res.end();
  }

  const tenantId = user.tenant_id || null;

  const message = await parseButtonMessage({
    raw: body.user_message || "",
    chatId,
    body,
    user
  });

  if (!message) return res.end();

  const parts = message.trim().split(/\s+/);
  let type = parts[0]?.toUpperCase();

  if (type?.startsWith("APPROVE_ALL_")) type = "APPROVE";
  else if (type?.startsWith("REJECT_ALL_")) type = "REJECT";

  const handler = handlerMap[type];

  if (!handler) {
    console.log("NO HANDLER:", type);
    return res.end();
  }

  const ctx = createContext({
    chatId,
    user,
    parts,
    message,
    res,
    reply,
    channel: "botcommerce"
  });

  try {
    return await handler(ctx);
  } catch (err) {
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

module.exports = router;