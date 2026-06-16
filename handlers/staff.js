const { withRole } = require("../core/withRole");
const { getStaffList } = require("../db/users/getStaffList");
const { formatStaffList, formatStaffListAdmin } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  const outletIds = await getAccessibleOutletIds(user);

  let data;
  try {
    data = await getStaffList(outletIds, tenantId);
  } catch (err) {
    console.log("STAFF ERROR:", err);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  // normalize managers dengan multi outlet
  let normalized = [];

  for (let u of data) {
    if (u.role === "staff" || u.role === "supervisor") {
      normalized.push({ ...u, outlets: u.outlets });
      continue;
    }
    if (u.role === "manager") {
      if (!u.user_outlets?.length) {
        normalized.push({ ...u, outlets: { name: "-" } });
        continue;
      }
      for (let rel of u.user_outlets) {
        normalized.push({ ...u, outlet_id: rel.outlet_id, outlets: rel.outlets });
      }
    }
  }

  const uniqueOutletIds = [...new Set(normalized.map(r => r.outlet_id))];

  if (uniqueOutletIds.length > 1) {
    await reply(chatId, formatStaffListAdmin(normalized));
  } else {
    await reply(chatId, formatStaffList(normalized));
  }

  return res.end();
});