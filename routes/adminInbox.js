const express = require("express");
const router = express.Router();

const supabase = require("../services/db");
const { sendWhatsAppMeta } = require("../services/notification/whatsappServiceMETA");
const { logMessage } = require("../services/logging/messageLogger");
const { requireAdminToken } = require("../core/requireAdminToken");

router.use(requireAdminToken);

// ======================
// GET LOGS
// ======================
router.get("/logs", async (req, res) => {
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

// ======================
// GET CONVERSATIONS
// ======================
router.get("/conversations", async (req, res) => {
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

// ======================
// GET USER INFO
// ======================
router.get("/user-info", async (req, res) => {
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

// ======================
// MARK READ
// ======================
router.post("/mark-read", async (req, res) => {
  const { chat_id, channel } = req.body;

  if (!chat_id) {
    return res.status(400).json({ error: "chat_id diperlukan" });
  }

  const { error } = await supabase
    .from("admin_chat_read_state")
    .upsert(
      { chat_id, channel: channel || "meta", last_read_at: new Date().toISOString() },
      { onConflict: "chat_id,channel" }
    );

  if (error) {
    console.log("MARK_READ ERROR:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

// ======================
// MANUAL SEND
// ======================
router.post("/send", async (req, res) => {
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

module.exports = router;