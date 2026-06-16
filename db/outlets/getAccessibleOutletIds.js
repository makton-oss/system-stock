const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getAccessibleOutletIds(user) {

  const tenantId = user.tenant_id || null;

  // ======================
  // MANAGER = MULTI OUTLET
  // ======================
  if (user.role === "manager") {
    let q = supabase
      .from("outlet_access")
      .select("outlet_id")
      .eq("user_chat_id", user.chat_id);

    const { data: links, error } = await q;
    if (error || !links?.length) return [];
    return links.map(x => x.outlet_id);
  }

  // ======================
  // SUPERVISOR = SINGLE
  // ======================
  if (user.role === "supervisor") {
    if (!user.outlet_id) return [];
    return [user.outlet_id];
  }

  // ======================
  // STAFF
  // ======================
  if (user.role === "staff") {
    if (!user.outlet_id) return [];
    return [user.outlet_id];
  }

  // ======================
  // OWNER = ALL OUTLETS IN TENANT
  // ======================
  if (user.role === "owner") {
    let q = supabase.from("outlets").select("id");
    q = applyTenant(q, tenantId);
    const { data, error } = await q;
    if (error || !data?.length) return [];
    return data.map(o => o.id);
  }

  // ======================
  // ADMIN (tenant-scoped) = ALL OUTLETS IN TENANT
  // ======================
  if (user.role === "admin") {
    let q = supabase.from("outlets").select("id");
    q = applyTenant(q, tenantId);
    const { data, error } = await q;
    if (error || !data?.length) return [];
    return data.map(o => o.id);
  }

  // ======================
  // SUPERADMIN = ALL OUTLETS
  // ======================
  if (user.role === "superadmin") {
    const { data } = await supabase.from("outlets").select("id");
    return data?.map(o => o.id) || [];
  }

  return [];
}

module.exports = { getAccessibleOutletIds };