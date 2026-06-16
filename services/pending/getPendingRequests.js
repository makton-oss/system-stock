const supabase = require("../db");
const { applyTenant } = require("../../utils/applyTenant");

async function getPendingRequests({ user, outletIds }) {

  const tenantId = user.tenant_id || null;

  let query = supabase
    .from("requests")
    .select(`
      id,
      type,
      item,
      qty,
      created_at,
      requested_by,
      outlet_id,
      outlets(name),
      users(nickname, chat_id)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (user.role !== "admin" && user.role !== "superadmin") {
    query = query.in("outlet_id", outletIds);
  }

  query = applyTenant(query, tenantId);

  return await query;
}

module.exports = { getPendingRequests };