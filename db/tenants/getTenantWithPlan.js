const supabase = require("../../services/db");

async function getTenantWithPlan(tenantId) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, plan, max_users")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = { getTenantWithPlan };