const supabase = require("../../services/db");

async function getManagersForOutlets(outletIds, tenantId = null) {

  if (!outletIds?.length) return [];

  let q = supabase
    .from("outlet_access")
    .select(`
      outlet_id,
      outlets(name),
      users!inner(chat_id, nickname, role, is_active, tenant_id)
    `)
    .in("outlet_id", outletIds)
    .eq("users.role", "manager")
    .eq("users.is_active", true);

  if (tenantId) {
    q = q.eq("users.tenant_id", tenantId);
  }

  const { data, error } = await q;

  if (error) {
    console.log("GET_MANAGERS_FOR_OUTLETS ERROR:", error);
    return [];
  }

  // ✅ sengaja satu row per (manager, outlet) — duplicate ikut outlet yang dia handle
  return (data || []).map(r => ({
    chat_id:   r.users.chat_id,
    nickname:  r.users.nickname,
    role:      "manager",
    outlet_id: r.outlet_id,
    outlets:   r.outlets
  }));
}

module.exports = { getManagersForOutlets };