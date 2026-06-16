const { withRole } = require("../core/withRole");
const { normalizeItem } = require("../utils/helpers");
const { getOutletByCode } = require("../db/outlets/getOutletByCode");
const { deleteStockByItem } = require("../db/stock/deleteStockByItem");

module.exports = withRole(["admin"], async (ctx) => {
  const { chatId, parts, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  const outletName = parts.at(-1);
  const item = normalizeItem(parts.slice(1, -1).join(" "));

  if (!item || !outletName) {
    await reply(chatId, "❌ FORMAT: REMOVEITEM ayam muiz\n[nama item] [outlet]");
    return res.end();
  }

  const outlet = await getOutletByCode(outletName, tenantId);
  if (!outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  const { error } = await deleteStockByItem(item, outlet.id, tenantId);
  if (error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  await reply(chatId, `✅ ITEM REMOVED\nItem: ${item}\nOutlet: ${outlet.name}`);
  return res.end();
});