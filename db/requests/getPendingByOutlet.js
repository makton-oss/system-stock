const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getPendingByOutlet(outletId, tenantId = null) {
  let q = supabase
    .from("requests")
    .select(`
      *,
      outlets(name),
      users(nickname, chat_id)
    `)
    .eq("status", "pending")
    .eq("outlet_id", outletId)
    .order("created_at", { ascending: true });

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = { getPendingByOutlet };