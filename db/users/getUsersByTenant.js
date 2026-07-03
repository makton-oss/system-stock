const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

// Dropdown source — Remove Role (active=true) / Reactivate (active=false) / Remove Outlet Access (active=true)
async function getUsersByTenant(tenantId, isActive = true) {
  let q = supabase
    .from("users")
    .select("chat_id, nickname, role, outlet_id, outlets(name)")
    .eq("is_active", isActive)
    .order("nickname", { ascending: true });

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) console.log("GET_USERS_BY_TENANT ERROR:", error);
  return data || [];
}

module.exports = { getUsersByTenant };