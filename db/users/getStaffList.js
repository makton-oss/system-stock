const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getStaffList(outletIds, tenantId = null) {
  let q = supabase
    .from("users")
    .select(`
      chat_id, nickname, role, outlet_id,
      outlets(name),
      outlet_access(outlet_id, outlets(name))
    `)                        // ✅ fix: user_outlets → outlet_access
    .in("outlet_id", outletIds)
    .neq("role", "admin")
    .neq("role", "superadmin")
    .eq("is_active", true);

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) console.log("GET_STAFF_LIST ERROR:", error);
  return data || [];
}

module.exports = { getStaffList };