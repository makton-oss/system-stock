const { withRole } = require("../core/withRole");
const { getPendingList } = require("../db/requests/getPendingList");
const { formatPending, formatPendingAdmin } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");

module.exports = withRole(["staff"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  const outletIds = await getAccessibleOutletIds(user);

  let data;
  try {
    data = await getPendingList(outletIds, tenantId);
  } catch (err) {
    console.log("LIST ERROR:", err);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  if (!data?.length) {
    await reply(chatId, "📭 TIADA REQUEST");
    return res.end();
  }

  const uniqueOutlet = [...new Set(data.map(r => r.outlet_id))];

  if (uniqueOutlet.length > 1) {
    await reply(chatId, formatPendingAdmin(data));
  } else {
    await reply(chatId, formatPending(data));
  }

  return res.end();
});