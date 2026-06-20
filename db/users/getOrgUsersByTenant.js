const supabase = require("../../services/db");

// admin & owner — outlet_id NULL, scope by tenant_id terus
async function getOrgUsersByTenant(tenantId, roles = []) {

  if (!tenantId || !roles.length) return [];

  const { data, error } = await supabase
    .from("users")
    .select("chat_id, nickname, role")
    .eq("tenant_id", tenantId)
    .in("role", roles)
    .eq("is_active", true);

  if (error) {
    console.log("GET_ORG_USERS_BY_TENANT ERROR:", error);
    return [];
  }

  return data || [];
}

module.exports = { getOrgUsersByTenant };