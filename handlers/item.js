const { withRole } = require("../core/withRole");
const { getStockNameList, getStockConfig } = require("../db/stock/getStockItems");
const { formatItemListAdmin, formatItemList, formatItemNameList } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { applyTenant } = require("../utils/applyTenant");

module.exports = withRole(["staff", "supervisor", "manager", "admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  // ======================
  // STAFF / SUPERVISOR → SIMPLE NAME LIST
  // ======================
  if (["staff", "supervisor"].includes(user.role)) {
    const staffData = await getStockNameList(user.outlet_id, tenantId);
    await reply(chatId, formatItemNameList(staffData));
    return res.end();
  }

  // ======================
  // ADMIN / MANAGER → MULTI OUTLET
  // ======================
  const outletIds = await getAccessibleOutletIds(user);
  const data = await getStockConfig(outletIds, tenantId);

  const uniqueOutlet = [...new Set(data.map(r => r.outlet_id))];

  if (uniqueOutlet.length > 1) {
    await reply(chatId, formatItemListAdmin(data));
  } else {
    await reply(chatId, formatItemList(data));
  }
  return res.end();
});