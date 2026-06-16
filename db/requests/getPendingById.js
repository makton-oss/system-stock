const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getPendingById(id, tenantId = null) {
  let q = supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .eq("status", "pending");

  q = applyTenant(q, tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) console.log("GET_PENDING_BY_ID ERROR:", error);
  return data || null;
}

module.exports = { getPendingById };