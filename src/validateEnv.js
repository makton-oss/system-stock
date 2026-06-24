const REQUIRED_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BOTCOMMERCE_URL",
  "BOTCOMMERCE_API",
  "PHONE_NUMBER_ID",
  "META_PHONE_NUMBER_ID",
  "META_ACCESS_TOKEN",
  "META_VERIFY_TOKEN",
  "ADMIN_LOG_TOKEN"
];

const OPTIONAL_VARS = [
  "DEFAULT_ADMIN",
  "DEFAULT_ADMIN_NAME",
  "SENTRY_DSN",
  "PORT"
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);

  if (missing.length) {
    console.error("❌ MISSING REQUIRED ENV VARS:");
    missing.forEach(v => console.error(`   - ${v}`));
    console.error("\nServer tidak boleh start tanpa vars ini.");
    process.exit(1);
  }

  const missingOptional = OPTIONAL_VARS.filter(v => !process.env[v]);
  if (missingOptional.length) {
    console.warn("⚠️  OPTIONAL ENV VARS not set (features may be limited):");
    missingOptional.forEach(v => console.warn(`   - ${v}`));
  }

  console.log("✅ ENV VALIDATED");
}

module.exports = { validateEnv };