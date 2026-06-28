const express = require("express");
const router = express.Router();

const supabase = require("../services/db");
const { requireAdminToken } = require("../core/requireAdminToken");

router.use(requireAdminToken);

// ======================
// SUBSCRIBE — simpan/refresh push subscription device
// Body: { endpoint, keys: { p256dh, auth } }  ← terus dari sub.toJSON()
// ======================
router.post("/subscribe", async (req, res) => {
  const { endpoint, keys } = req.body || {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "INVALID_SUBSCRIPTION" });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.log("PUSH_SUBSCRIBE_ERROR:", error);
    return res.status(500).json({ error: "DB_ERROR" });
  }

  res.json({ ok: true });
});

// ======================
// UNSUBSCRIBE — optional, untuk bila nak disable notification
// ======================
router.post("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "ENDPOINT_REQUIRED" });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return res.status(500).json({ error: "DB_ERROR" });
  res.json({ ok: true });
});

module.exports = router;
