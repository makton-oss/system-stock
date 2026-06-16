const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getOutletByCode(code, tenantId = null) {
  let q = supabase
    .from("outlets")
    .select("id, name")
    .ilike("name", code);

  q = applyTenant(q, tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) console.log("GET_OUTLET_BY_CODE ERROR:", error);
  return data || null;
}

module.exports = { getOutletByCode };