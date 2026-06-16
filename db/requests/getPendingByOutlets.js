const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getPendingByOutlets(outletIds, tenantId = null) {
  let q = supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .in("outlet_id", outletIds);

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = { getPendingByOutlets };