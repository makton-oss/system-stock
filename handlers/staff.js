const { withRole } = require("../core/withRole");
const { getStaffList } = require("../db/users/getStaffList");
const { getManagersForOutlets } = require("../db/users/getManagersForOutlets");
const { getOrgUsersByTenant } = require("../db/users/getOrgUsersByTenant");
const { getGlobalStaffSummary } = require("../db/users/getGlobalStaffSummary");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getAllOutlets } = require("../db/outlets/getAllOutlets");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");
const { formatStaffOrgView, formatStaffSummaryGlobal } = require("../utils/formatter");

// ======================
// MERGE staff/supervisor + manager → group by outlet
// (duplicate manager ikut outlet yang dia handle — by design)
// ======================
function buildOutletGroups(staffRows, managerRows) {

  const map = new Map();

  function getEntry(outletId, outletName) {
    if (!map.has(outletId)) {
      map.set(outletId, {
        outletId,
        outletName,
        managers: [],
        supervisors: [],
        staff: []
      });
    }
    return map.get(outletId);
  }

  staffRows.forEach(r => {
    const entry = getEntry(r.outlet_id, r.outlets?.name || "-");
    if (r.role === "supervisor") entry.supervisors.push(r);
    else if (r.role === "staff") entry.staff.push(r);
  });

  managerRows.forEach(r => {
    const entry = getEntry(r.outlet_id, r.outlets?.name || "-");
    entry.managers.push(r);
  });

  return [...map.values()].sort((a, b) => a.outletId - b.outletId);
}

module.exports = withRole(["manager", "admin", "owner"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  // ======================
  // SUPERADMIN — bypass withRole, handle sendiri kat sini
  // ======================
  if (user.role === "superadmin") {

    const arg = parts[1];

    // ---- GLOBAL SUMMARY (tiada @slug) ----
    if (!arg) {
      const summary = await getGlobalStaffSummary();
      await reply(chatId, formatStaffSummaryGlobal(summary));
      return res.end();
    }

    // ---- SCOPED @slug — full hierarchy satu tenant ----
    if (!arg.startsWith("@")) {
      await reply(chatId, "❌ FORMAT: STAFF @slugtenant");
      return res.end();
    }

    const slug = arg.slice(1);
    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
      await reply(chatId, `❌ TENANT TAK WUJUD: ${slug}`);
      return res.end();
    }

    const { data: outlets, error: outletError } = await getAllOutlets(tenant.id);

    if (outletError) {
      await reply(chatId, "❌ ERROR OUTLET");
      return res.end();
    }

    const outletIds = outlets.map(o => o.id);

    const [staffRows, managerRows, admins, owners] = await Promise.all([
      getStaffList(outletIds, tenant.id),
      getManagersForOutlets(outletIds, tenant.id),
      getOrgUsersByTenant(tenant.id, ["admin"]),
      getOrgUsersByTenant(tenant.id, ["owner"])
    ]);

    const outletGroups = buildOutletGroups(staffRows, managerRows);

    await reply(chatId, formatStaffOrgView({ outletGroups, admins, owners }));
    return res.end();
  }

  // ======================
  // MANAGER / ADMIN / OWNER
  // ======================
  const tenantId  = user.tenant_id || null;
  const outletIds = await getAccessibleOutletIds(user);

  const [staffRows, managerRows] = await Promise.all([
    getStaffList(outletIds, tenantId),
    getManagersForOutlets(outletIds, tenantId)
  ]);

  const outletGroups = buildOutletGroups(staffRows, managerRows);

  let admins = [];
  let owners = [];

  if (user.role === "admin") {
    admins = await getOrgUsersByTenant(tenantId, ["admin"]);
  }

  if (user.role === "owner") {
    admins = await getOrgUsersByTenant(tenantId, ["admin"]);
    owners = await getOrgUsersByTenant(tenantId, ["owner"]);
  }

  await reply(chatId, formatStaffOrgView({ outletGroups, admins, owners }));
  return res.end();
});