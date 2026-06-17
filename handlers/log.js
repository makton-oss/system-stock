const { withRole } = require("../core/withRole");
const { getLogs } = require("../db/logs/getLogs");
const { formatLogs } = require("../utils/formatter");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  let tenantId = user.tenant_id || null;

  // ======================
  // SUPERADMIN: LOG @slug → filter specific tenant
  // SUPERADMIN: LOG       → semua tenant (20 latest global)
  // ADMIN:      LOG       → tenant sendiri
  // ======================
  if (isSuperadmin && parts[1]?.startsWith("@")) {

    const slug = parts[1].slice(1);
    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
      await reply(chatId, `❌ TENANT TAK WUJUD: ${slug}`);
      return res.end();
    }

    tenantId = tenant.id;
  }

  const data = await getLogs(tenantId, 20);
  const text = await formatLogs(data);

  await reply(chatId, text);
  return res.end();
});