const supabase = require("../services/db");

async function getManagersByOutlet(outletId) {

  // ======================
  // MANAGERS (dari outlet_access)
  // ======================
  const { data: managerLinks, error: managerError } = await supabase
    .from("outlet_access")
    .select(`
      user_chat_id,
      users!inner(chat_id, role, is_active)
    `)
    .eq("outlet_id", outletId)
    .eq("users.role", "manager")
    .eq("users.is_active", true);

  if (managerError) {
    console.log("GETMANAGERS ERROR:", managerError);
  }

  // ======================
  // SUPERVISORS (dari users.outlet_id)
  // ======================
  const { data: supervisors, error: svError } = await supabase
    .from("users")
    .select("chat_id")
    .eq("outlet_id", outletId)
    .eq("role", "supervisor")
    .eq("is_active", true);

  if (svError) {
    console.log("GETSUPERVISORS ERROR:", svError);
  }

  const managers = (managerLinks || []).map(l => ({ chat_id: l.user_chat_id }));
  const svList   = (supervisors  || []).map(u => ({ chat_id: u.chat_id }));

  // dedupe kalau ada overlap
  const seen = new Set();
  const combined = [...managers, ...svList].filter(u => {
    if (seen.has(u.chat_id)) return false;
    seen.add(u.chat_id);
    return true;
  });

  return combined;
}

module.exports = { getManagersByOutlet };