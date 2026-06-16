const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getManagersByTenant(tenantId = null) {
  let q = supabase
    .from("users")
    .select("chat_id, nickname")
    .eq("role", "manager")
    .eq("is_active", true);

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) console.log("GET_MANAGERS_BY_TENANT ERROR:", error);
  return { data: data || [], error };
}

module.exports = { getManagersByTenant };