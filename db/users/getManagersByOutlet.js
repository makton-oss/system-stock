const supabase = require("../../services/db");

async function getManagersByOutlet(outletId, tenantId = null) {

  // ======================
  // MANAGERS (dari outlet_access)
  // ======================
  let managerQ = supabase
    .from("outlet_access")
    .select(`
      user_chat_id,
      users!inner(chat_id, role, is_active, tenant_id)
    `)
    .eq("outlet_id", outletId)
    .eq("users.role", "manager")
    .eq("users.is_active", true);

  if (tenantId) {
    managerQ = managerQ.eq("users.tenant_id", tenantId);
  }

  const { data: managerLinks, error: managerError } = await managerQ;

  if (managerError) {
    console.log("GET_MANAGERS ERROR:", managerError);
  }

  // ======================
  // SUPERVISORS (dari users.outlet_id)
  // ======================
  let svQ = supabase
    .from("users")
    .select("chat_id")
    .eq("outlet_id", outletId)
    .eq("role", "supervisor")
    .eq("is_active", true);

  if (tenantId) {
    svQ = svQ.eq("tenant_id", tenantId);
  }

  const { data: supervisors, error: svError } = await svQ;

  if (svError) {
    console.log("GET_SUPERVISORS ERROR:", svError);
  }

  const managers = (managerLinks || []).map(l => ({ chat_id: l.user_chat_id }));
  const svList   = (supervisors  || []).map(u => ({ chat_id: u.chat_id }));

  // dedupe
  const seen = new Set();
  const combined = [...managers, ...svList].filter(u => {
    if (seen.has(u.chat_id)) return false;
    seen.add(u.chat_id);
    return true;
  });

  return combined;
}

module.exports = { getManagersByOutlet };