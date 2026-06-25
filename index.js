const express = require("express");
require("dotenv").config();
const supabase = require("./services/db");
const startCronJobs = require("./src/jobs/startCronJobs");
const { gracefulShutdown, isShutdown } = require("./src/shutdown");
const { Sentry, initSentry } = require("./services/sentry");
const { validateEnv } = require("./src/validateEnv");

validateEnv();
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
// HEALTH CHECK
// ======================
app.get("/health", async (req, res) => {
  const status = {
    http: "ok",
    supabase: "unknown",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from("tenants")
      .select("id")
      .limit(1);

    status.supabase = error ? "error" : "ok";

    if (error) {
      console.error("HEALTH CHECK SUPABASE ERROR:", error);
      return res.status(503).json(status);
    }

    return res.status(200).json(status);

  } catch (err) {
    status.supabase = "error";
    console.error("HEALTH CHECK EXCEPTION:", err);
    return res.status(503).json(status);
  }
});

// ======================
// STATIC FILES
// ======================
app.use(express.static("public"));

// ======================
// ADMIN ROUTES
// ======================
app.use("/admin", require("./routes/adminInbox"));
app.use("/admin/import", require("./routes/adminImport"));
app.use("/admin", require("./routes/adminTools"));

// ======================
// CRON JOBS
// ======================
startCronJobs();

// ======================
// WEBHOOKS
// — meta MESTI mount dulu sebelum botcommerce (lihat routes/webhookBotcommerce.js
//   untuk kenapa rate limiter di-scope kat route-level, bukan router.use)
// ======================
app.use("/webhook/meta", require("./routes/webhookMeta"));
app.use("/webhook", require("./routes/webhookBotcommerce"));

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