const supabase = require("../../services/db");

async function getGlobalStaffSummary() {

  const { data: tenants, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("is_active", true);

  if (tenantError) {
    console.log("GET_GLOBAL_SUMMARY TENANT ERROR:", tenantError);
    return [];
  }

  if (!tenants?.length) return [];

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("chat_id, tenant_id, role")
    .eq("is_active", true)
    .in("role", ["staff", "supervisor", "manager", "admin", "owner"]); // ✅ tambah owner

  if (userError) {
    console.log("GET_GLOBAL_SUMMARY USER ERROR:", userError);
    return [];
  }

  const { data: outlets, error: outletError } = await supabase
    .from("outlets")
    .select("id, tenant_id");

  if (outletError) {
    console.log("GET_GLOBAL_SUMMARY OUTLET ERROR:", outletError);
    return [];
  }

  const map  = new Map();
  const seen = new Set(); // ✅ dedupe guard

  tenants.forEach(t => {
    map.set(t.id, {
      tenantId:    t.id,
      tenantName:  t.name,
      outletCount: 0,
      owner: 0, admin: 0, manager: 0, supervisor: 0, staff: 0
    });
  });

  outlets.forEach(o => {
    const entry = map.get(o.tenant_id);
    if (entry) entry.outletCount++;
  });

  users.forEach(u => {
    const entry = map.get(u.tenant_id);
    if (!entry) return;

    // ✅ pastikan setiap chat_id dikira SEKALI je per (tenant, role) —
    // jamin manager multi-outlet tak pernah double count
    const dedupeKey = `${u.tenant_id}-${u.role}-${u.chat_id}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    if (u.role === "owner")      entry.owner++;
    if (u.role === "admin")      entry.admin++;
    if (u.role === "manager")    entry.manager++;
    if (u.role === "supervisor") entry.supervisor++;
    if (u.role === "staff")      entry.staff++;
  });

  return [...map.values()];
}

module.exports = { getGlobalStaffSummary };