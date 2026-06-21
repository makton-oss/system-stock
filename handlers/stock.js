const { withRole } = require("../core/withRole");
const { getStockAll } = require("../db/stock/getStockAll");
const { formatStock, formatStockAdmin } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");

module.exports = withRole(["staff", "supervisor" ,"manager","admin", "owner"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

  const outletIds = user.role === "admin"
    ? null
    : await getAccessibleOutletIds(user);

  const data = await getStockAll(outletIds, user.tenant_id || null);

  if (!data.length) {
    await reply(chatId, "📦 STOCK KOSONG");
    return res.end();
  }

  const uniqueOutlet = [...new Set(data.map(r => r.outlet_id))];

  if (uniqueOutlet.length > 1) {
    await reply(chatId, formatStockAdmin(data));
  } else {
    await reply(chatId, formatStock(data));
  }
  return res.end();
});