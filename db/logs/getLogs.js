const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getLogs(tenantId = null, limit = 20) {
  let q = supabase
    .from("audit_logs")              // ✅ betul — bukan logs
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) console.log("GET_LOGS ERROR:", error);
  return data || [];
}

module.exports = { getLogs };