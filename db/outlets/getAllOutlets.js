const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getAllOutlets(tenantId = null) {
  let q = supabase.from("outlets").select("id, name");
  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) console.log("GET_ALL_OUTLETS ERROR:", error);
  return { data: data || [], error };
}

module.exports = { getAllOutlets };