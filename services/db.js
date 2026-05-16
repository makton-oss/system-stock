const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// detect env
const isProduction = process.env.NODE_ENV === "production";

// pick config ikut env
const supabaseUrl = isProduction
  ? process.env.SUPABASE_URL
  : process.env.SUPABASE_URL_DEV;

const supabaseKey = isProduction
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY_DEV;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ENV MISSING");
  process.exit(1);
}

console.log("🔥 USING DB:", isProduction ? "PROD" : "DEV");

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: WebSocket
  }
});

module.exports = supabase;