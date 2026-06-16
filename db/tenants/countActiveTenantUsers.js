const supabase = require("../../services/db");

async function countActiveTenantUsers(tenantId) {
  const { count, error } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) throw error;
  return count || 0;
}

module.exports = { countActiveTenantUsers };