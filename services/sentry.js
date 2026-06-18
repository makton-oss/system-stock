const Sentry = require("@sentry/node");

function initSentry() {

  if (!process.env.SENTRY_DSN) {
    console.log("⚠️ SENTRY_DSN not set — skipping Sentry init");
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0.2  // 20% transaction sampling — cukup untuk monitor
  });

  try {
    foo();
  } catch (e) {
    Sentry.captureException(e);
  }

  console.log("✅ SENTRY INITIALIZED");
}

module.exports = { Sentry, initSentry };