const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getOutletById(outletId, tenantId = null) {
  let q = supabase
    .from("outlets")
    .select("id, name")
    .eq("id", outletId);

  q = applyTenant(q, tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) console.log("GET_OUTLET_BY_ID ERROR:", error);
  return data || null;
}

module.exports = { getOutletById };