const { getTenantWithPlan } = require("../../db/tenants/getTenantWithPlan");
const { countActiveTenantUsers } = require("../../db/tenants/countActiveTenantUsers");

async function checkUserLimit(tenantId) {
  if (!tenantId) return { allowed: true }; // superadmin bypass

  const tenant = await getTenantWithPlan(tenantId);
  if (!tenant) return { allowed: false, reason: "TENANT_NOT_FOUND" };

  const max = tenant.max_users;
  if (!max) return { allowed: true }; // unlimited plan

  const current = await countActiveTenantUsers(tenantId);
  if (current >= max) {
    return { allowed: false, reason: "LIMIT_REACHED", current, max };
  }

  return { allowed: true, current, max };
}

module.exports = { checkUserLimit };