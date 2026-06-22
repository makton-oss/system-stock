const express = require("express");
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const startCronJobs = require("./src/jobs/startCronJobs");
const supabase = require("./services/db");
const handlerMap = require("./core/handlerMap");
const { createContext } = require("./core/context");
const { sendWhatsApp } = require("./services/notification/whatsappService");
const { sendWhatsAppMeta } = require("./services/notification/whatsappServiceMETA");
const { parseButtonMessage } = require("./utils/parseButtonMessage");
const { getUserByChatId } = require("./db/users/getUserByChatId");
const { checkUserRateLimit } = require("./utils/userRateLimit");
const { checkTenantRateLimit } = require("./utils/tenantRateLimit");
const { gracefulShutdown, isShutdown } = require("./src/shutdown");
const { logMessage } = require("./services/logging/messageLogger");
const { Sentry, initSentry } = require("./services/sentry");
const { runBulkImportItems } = require("./services/imports/runBulkImportItems");
const { runBulkImportUsers } = require("./services/imports/runBulkImportUsers");

initSentry();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

// ======================
// REJECT DURING SHUTDOWN
// ======================
app.use((req, res, next) => {
  if (isShutdown()) return res.status(503).end();
  next();
});

// ======================
// GLOBAL RATE LIMIT — untuk /webhook botcommerce sahaja
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

// ======================
// HEALTH CHECK
// ======================
app.get("/health", (req, res) => {
  res.send("OK");
});

// ======================
// FILE UPLOAD CONFIG — untuk admin bulk import (.xlsx)
// Fail disimpan sementara dalam tmp_uploads/, automatik dipadam
// lepas proses import settle (success ATAU fail) — tengok finally{} block kat bawah
// ======================
const uploadDir = path.join(__dirname, "tmp_uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB per fail
  fileFilter: (req, file, cb) => {
    // hanya terima .xlsx — fail lain ditolak senyap (req.file jadi undefined)
    cb(null, file.originalname.toLowerCase().endsWith(".xlsx"));
  }
});

// ======================
// ADMIN LOGS, CONVERSATIONS, USER INFO, SEND MESSAGE
// ======================
app.get("/admin/logs", async (req, res) => {
  if (req.query.token !== process.env.ADMIN_LOG_TOKEN) {
    return res.status(403).end();
  }

  let q = supabase
    .from("message_logs")
    .select("*")
    .eq("channel", req.query.channel || "meta")
    .order("created_at", { ascending: false })
    .limit(200);

  if (req.query.chat_id) q = q.eq("chat_id", req.query.chat_id);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/admin/conversations", async (req, res) => {
  if (req.query.token !== process.env.ADMIN_LOG_TOKEN) {
    return res.status(403).end();
  }

  const channel = req.query.channel || "meta";

  const { data: convos, error } = await supabase.rpc("get_conversations", {
    p_channel: channel,
    p_limit: 100
  });

  if (error) return res.status(500).json({ error: error.message });

  const chatIds = convos.map(c => c.chat_id);
  const { data: users } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .in("chat_id", chatIds.length ? chatIds : ["__none__"]);

  const nickMap = {};
  (users || []).forEach(u => { nickMap[u.chat_id] = u.nickname; });

  res.json(convos.map(c => ({ ...c, nickname: nickMap[c.chat_id] || null })));
});

app.get("/admin/user-info", async (req, res) => {
  if (req.query.token !== process.env.ADMIN_LOG_TOKEN) {
    return res.status(403).end();
  }

  const chatId = req.query.chat_id;
  if (!chatId) return res.status(400).json({ error: "chat_id diperlukan" });

  const { data: user, error } = await supabase
    .from("users")
    .select("chat_id, nickname, role, tenant_id, outlets(name)")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!user) return res.json(null);

  let tenant = null;
  if (user.tenant_id) {
    const { data: t } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", user.tenant_id)
      .maybeSingle();
    tenant = t;
  }

  res.json({
    chat_id: user.chat_id,
    nickname: user.nickname,
    role: user.role,
    outlet_name: user.outlets?.name || null,
    tenant_slug: tenant?.slug || null
  });
});

app.post("/admin/send", async (req, res) => {
  if (req.query.token !== process.env.ADMIN_LOG_TOKEN) {
    return res.status(403).end();
  }

  const { chat_id, message } = req.body;

  if (!chat_id || !message) {
    return res.status(400).json({ error: "chat_id dan message diperlukan" });
  }

  const result = await sendWhatsAppMeta(chat_id, message);

  if (!result.ok) {
    return res.status(500).json({ error: result.reason || "SEND_FAILED" });
  }

  await logMessage({ channel: "meta", direction: "out", chatId: chat_id, message, msgType: "manual" });

  res.json({ ok: true });
});

// ======================
// ADMIN BULK IMPORT — ITEMS (.xlsx upload dari browser)
// UI: public/admin/import.html
// Logic sebenar (parse + validate + insert) DIKONGSI dengan CLI script
// scripts/bulkImportItems.js → kedua-dua panggil services/imports/runBulkImportItems.js
// supaya tiada duplicate logic antara CLI dan web.
// ======================
app.post("/admin/import/items", upload.single("file"), async (req, res) => {

  // ✅ AUTH CHECK DULU — kalau token salah, padam fail yang dah ke-upload sekali
  if (req.query.token !== process.env.ADMIN_LOG_TOKEN) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(403).end();
  }

  if (!req.file) {
    return res.status(400).json({ error: "FILE_REQUIRED (.xlsx sahaja)" });
  }

  const slug   = req.body.slug;
  const dryRun = req.body.dryRun === "true";

  if (!slug) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "SLUG_REQUIRED" });
  }

  try {
    const result = await runBulkImportItems({ slug, filePath: req.file.path, dryRun });
    res.json(result);
  } catch (err) {
    console.error("IMPORT ITEMS ERROR:", err);
    res.status(500).json({ error: "IMPORT_FAILED" });
  } finally {
    // ✅ SELALU padam fail sementara — tak kira success ke fail
    fs.unlink(req.file.path, () => {});
  }
});

// ======================
// ADMIN BULK IMPORT — USERS (.xlsx upload dari browser)
// UI: public/admin/import.html (right panel)
// Logic dikongsi dengan scripts/bulkImportUsers.js
// ======================
app.post("/admin/import/users", upload.single("file"), async (req, res) => {

  if (req.query.token !== process.env.ADMIN_LOG_TOKEN) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(403).end();
  }

  if (!req.file) {
    return res.status(400).json({ error: "FILE_REQUIRED (.xlsx sahaja)" });
  }

  const slug   = req.body.slug;
  const dryRun = req.body.dryRun === "true";

  if (!slug) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "SLUG_REQUIRED" });
  }

  try {
    const result = await runBulkImportUsers({ slug, filePath: req.file.path, dryRun });
    res.json(result);
  } catch (err) {
    console.error("IMPORT USERS ERROR:", err);
    res.status(500).json({ error: "IMPORT_FAILED" });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// ======================
// USE STATIC FILES
// ======================
app.use(express.static("public"));

// ======================
// CRON JOBS
// ======================
startCronJobs();

// ======================
// REPLY FUNCTIONS
// ======================
async function reply(chatId, text) {
  try {
    console.log("REPLY TO:", chatId, "|", text.slice(0, 50));
    await sendWhatsApp(chatId, text);
  } catch (err) {
    console.error("REPLY ERROR:", err);
  }
}

async function replyMeta(chatId, text) {
  try {
    console.log(`[META_OUT] ${chatId} | ${text}`);
    await logMessage({ channel: "meta", direction: "out", chatId, message: text });
    await sendWhatsAppMeta(chatId, text);
  } catch (err) {
    console.error(`[META_OUT_ERROR] ${chatId}`, err);
  }
}

// ======================
// META WEBHOOK VERIFY (GET)
// — MESTI sebelum globalLimiter
// ======================
app.get("/webhook/meta", (req, res) => {
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
app.post("/webhook/meta", async (req, res) => {

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
        reply: replyMeta
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
      reply: replyMeta
    });

    await handler(ctx);

  } catch (err) {
    Sentry.captureException(err);
    console.error("META HANDLER ERROR:", err);
  }
});

// ======================
// BOTCOMMERCE WEBHOOK — dengan rate limiter
// ======================
app.use("/webhook", globalLimiter);

app.post("/webhook", async (req, res) => {

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
    console.log("NO HANDLER:", type);
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
// GRACEFUL SHUTDOWN
// ======================
process.on("SIGTERM", () => gracefulShutdown(server));
process.on("SIGINT",  () => gracefulShutdown(server));