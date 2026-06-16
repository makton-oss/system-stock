const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getPendingList(outletIds, tenantId = null) {
  let q = supabase
    .from("requests")
    .select(`
      id, type, item, qty, created_at,
      outlet_id,
      outlets(name),
      users(nickname, chat_id)
    `)
    .eq("status", "pending")
    .in("outlet_id", outletIds)
    .order("created_at", { ascending: true });

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = { getPendingList };