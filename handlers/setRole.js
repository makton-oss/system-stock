const { withRole } = require("../core/withRole");
const { getRoleGuide } = require("../utils/formatter");
const { getAllOutlets } = require("../db/outlets/getAllOutlets");
const { upsertUser } = require("../db/users/upsertUser");
const { getUserOutletIds, insertUserOutlets, clearUserOutlets } = require("../db/users/manageUserOutlets");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  if (parts.length < 5) {
    await reply(chatId, "❌ FORMAT: SETROLE phone role nickname outlet1,outlet2");
    return res.end();
  }

  const phone       = parts[1].replace(/[^\d]/g, "");
  const role        = parts[2].toLowerCase();
  const nickname    = parts[3];
  const outletNames = parts.slice(4).join(" ").split(",");

  // ======================
  // GET OUTLETS
  // ======================
  const { data: outlets, error } = await getAllOutlets(tenantId);

  if (error) {
    await reply(chatId, "❌ ERROR OUTLET");
    return res.end();
  }

  const matched = outletNames.map(name =>
    outlets.find(o => o.name.toLowerCase() === name.trim().toLowerCase())
  );

  if (matched.some(m => !m)) {
    await reply(chatId, "❌ ADA OUTLET TAK WUJUD");
    return res.end();
  }

  const outletIds = matched.map(m => m.id);

  // ======================
  // VALIDATION
  // ======================
  if ((role === "staff" || role === "supervisor") && outletIds.length > 1) {
    await reply(chatId, "❌ STAFF dan SUPERVISOR hanya boleh 1 outlet");
    return res.end();
  }

  // ======================
  // UPSERT USER
  // ======================
  const { error: upsertError } = await upsertUser({
    phone,
    role,
    nickname,
    outletId: outletIds[0],
    tenantId
  });

  if (upsertError) {
    await reply(chatId, "❌ ERROR SET ROLE");
    return res.end();
  }

  // ======================
  // MANAGE OUTLET LINKS
  // ======================
  if (role === "manager") {
    const existingIds = await getUserOutletIds(phone);
    const newIds = outletIds.filter(id => !existingIds.includes(id));

    if (newIds.length) {
      await insertUserOutlets(phone, newIds);
    }
  } else {
    await clearUserOutlets(phone);
  }

  // ======================
  // NOTIFY
  // ======================
  await reply(chatId, `✅ ${nickname} set sebagai ${role}`);

  const guide = getRoleGuide(role);
  if (guide) await reply(phone, guide);

  return res.end();
});