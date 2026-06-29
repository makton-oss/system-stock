const express = require("express");
const router = express.Router();

const handlerMap = require("../core/handlerMap");
const { createContext } = require("../core/context");
const { getUserByTelegramId, linkTelegramId, savePendingLink, deletePendingLink } = require("../db/users/getTelegramUser");
const { getUserByChatId } = require("../db/users/getUserByChatId");
const { checkUserRateLimit } = require("../utils/userRateLimit");
const { checkTenantRateLimit } = require("../utils/tenantRateLimit");
const { parseButtonMessage } = require("../utils/parseButtonMessage");
const { sendTelegram, requestContact, answerCallbackQuery } = require("../services/notification/telegramService");
const { isDuplicate } = require("../services/notification/telegramDedup");
const { Sentry } = require("../services/sentry");
const supabase = require("../services/db");

// ======================
// NORMALIZE PHONE — pastikan format 60xxxxxxxxx
// ======================
function normalizePhone(raw = "") {
  let phone = raw.replace(/[\s+\-]/g, "");

  // buang semua non-digit
  phone = phone.replace(/[^\d]/g, "");

  // 0123456789 → 60123456789
  if (phone.startsWith("0")) {
    phone = "60" + phone.slice(1);
  }

  return phone;
}

// ======================
// VERIFY TELEGRAM WEBHOOK
// ======================
router.get("/", (req, res) => res.send("Telegram webhook active"));

// ======================
// TELEGRAM INCOMING
// ======================
router.post("/", async (req, res) => {

  res.status(200).end();

  try {
    const body = req.body;

    // ======================
    // DEDUP — ignore duplicate updates
    // ======================
    if (!body.update_id || isDuplicate(body.update_id)) {
      console.log("TELEGRAM DEDUP HIT:", body.update_id);
      return;
    }

    // ======================
    // CALLBACK QUERY (button press)
    // ======================
    if (body.callback_query) {
      const cq         = body.callback_query;
      const telegramId = String(cq.from.id);
      const data       = cq.data || "";

      await answerCallbackQuery(cq.id);

      const user = await getUserByTelegramId(telegramId);
      if (!user) {
        await sendTelegram(telegramId, "❌ Anda belum didaftarkan. Sila taip /start");
        return;
      }

      await processMessage({
        telegramId,
        user,
        rawMessage: `#Button Reply#${data}`
      });

      return;
    }

    // ======================
    // REGULAR MESSAGE
    // ======================
    const msg = body.message;
    if (!msg) return;

    const telegramId = String(msg.from.id);

    // ======================
    // HANDLE /start
    // ======================
    if (msg.text === "/start") {

      const existingUser = await getUserByTelegramId(telegramId);

      if (existingUser) {
        await sendTelegram(
          telegramId,
          `✅ Anda sudah didaftarkan sebagai ${existingUser.nickname}.\n\nTaip HELP untuk senarai arahan.`
        );
        return;
      }

      await savePendingLink(telegramId);
      await requestContact(telegramId);
      return;
    }

    // ======================
    // HANDLE CONTACT SHARE (self-register)
    // ======================
    if (msg.contact) {
      const phone = normalizePhone(msg.contact.phone_number);

      const existingUser = await getUserByChatId(phone);

      if (!existingUser) {
        await sendTelegram(telegramId, "❌ Nombor telefon tidak dijumpai dalam sistem. Hubungi admin anda.");
        return;
      }

      const { error } = await linkTelegramId(phone, telegramId);

      if (error) {
        await sendTelegram(telegramId, "❌ Gagal mendaftar. Sila cuba lagi atau hubungi admin.");
        return;
      }

      await deletePendingLink(telegramId);
      await sendTelegram(telegramId, `✅ Berjaya didaftarkan sebagai ${existingUser.nickname}!\n\nTaip HELP untuk senarai arahan.`);
      return;
    }

    // ======================
    // HANDLE MANUAL PHONE NUMBER INPUT
    // ======================
    if (msg.text && /^[0-9]{10,15}$/.test(normalizePhone(msg.text))) {

      const { data: pending } = await supabase
        .from("telegram_pending_links")
        .select("telegram_chat_id")
        .eq("telegram_chat_id", telegramId)
        .maybeSingle();

      if (pending) {
        const phone = normalizePhone(msg.text);

        const existingUser = await getUserByChatId(phone);

        if (!existingUser) {
          await sendTelegram(telegramId, "❌ Nombor telefon tidak dijumpai dalam sistem. Hubungi admin anda.");
          return;
        }

        const { error } = await linkTelegramId(phone, telegramId);

        if (error) {
          await sendTelegram(telegramId, "❌ Gagal mendaftar. Sila cuba lagi atau hubungi admin.");
          return;
        }

        await deletePendingLink(telegramId);
        await sendTelegram(telegramId, `✅ Berjaya didaftarkan sebagai ${existingUser.nickname}!\n\nTaip HELP untuk senarai arahan.`);
        return;
      }
    }

    // ======================
    // REGULAR COMMAND
    // ======================
    if (!msg.text) return;

    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      await sendTelegram(telegramId, "❌ Anda belum didaftarkan.\n\nSila taip /start untuk mendaftar.");
      return;
    }

    await processMessage({
      telegramId,
      user,
      rawMessage: msg.text
    });

  } catch (err) {
    Sentry.captureException(err);
    console.error("TELEGRAM HANDLER ERROR:", err);
  }
});

// ======================
// PROCESS MESSAGE — shared logic
// ======================
async function processMessage({ telegramId, user, rawMessage }) {

  const { allowed } = checkUserRateLimit(telegramId);
  if (!allowed) {
    await sendTelegram(telegramId, "⏳ Terlalu banyak request. Cuba lagi sebentar.");
    return;
  }

  const { allowed: tenantAllowed } = checkTenantRateLimit(user.tenant_id);
  if (!tenantAllowed) {
    await sendTelegram(telegramId, "⏳ Sistem sibuk. Cuba lagi sebentar.");
    return;
  }

  const replyFn = (_, text) => sendTelegram(telegramId, text);

  const message = await parseButtonMessage({
    raw: rawMessage,
    chatId: telegramId,
    body: { reply_message_id: null },
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
      chatId: telegramId,
      user,
      parts,
      message,
      res: { end: () => {} },
      reply: replyFn,
      channel: "telegram"
    });
    return await handler(ctx);
  }

  const handler = handlerMap[type];
  if (!handler) {
    console.log("TELEGRAM NO HANDLER:", type);
    return;
  }

  const ctx = createContext({
    chatId: telegramId,
    user,
    parts,
    message,
    res: { end: () => {} },
    reply: replyFn,
    channel: "telegram"
  });

  try {
    await handler(ctx);
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        telegramId,
        type,
        role: user?.role,
        tenant_id: user?.tenant_id
      }
    });
    console.error("TELEGRAM HANDLER ERROR:", err);
    await sendTelegram(telegramId, "❌ SYSTEM ERROR");
  }
}

module.exports = router;