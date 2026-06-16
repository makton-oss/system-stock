const { withRole } = require("../core/withRole");
const { normalizeItem } = require("../utils/helpers");
const { getOutletByCode } = require("../db/outlets/getOutletByCode");
const { getStockItemByName, createStockItem, checkStockExistsByItemId, insertStock } = require("../db/stock/manageStockItem");

module.exports = withRole(["admin"], async (ctx) => {
  const { chatId, parts, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  // ======================
  // MIN ARG CHECK
  // ======================
  if (parts.length < 7) {
    await reply(chatId, "❌ FORMAT: ADDITEM ayam dara basah kering 10 3.4 ketul muiz");
    return res.end();
  }

  // ======================
  // PARSE INPUT
  // ======================
  const outletName  = parts.at(-1);
  const uom         = parts.at(-2);
  const cost        = parseFloat(parts.at(-3));
  const minQty      = parseInt(parts.at(-4));
  const category    = parts.at(-5);
  const itemNameRaw = parts.slice(1, -5).join(" ");
  const item        = normalizeItem(itemNameRaw);

  if (!item || !category || isNaN(minQty) || isNaN(cost) || !uom || !outletName) {
    await reply(chatId, "❌ FORMAT: ADDITEM ayam dara basah kering 10 3.4 ketul muiz");
    return res.end();
  }

  // ======================
  // GET OUTLET (scoped to tenant)
  // ======================
  const outlet = await getOutletByCode(outletName, tenantId);
  if (!outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  // ======================
  // CHECK / CREATE STOCK ITEM (MASTER)
  // ======================
  let itemId;
  const existingItem = await getStockItemByName(item, tenantId);

  if (existingItem) {
    itemId = existingItem.id;
  } else {
    const { data: newItem, error: itemError } = await createStockItem(item, category, tenantId);
    if (itemError) {
      await reply(chatId, "❌ DB ERROR (ITEM)");
      return res.end();
    }
    itemId = newItem.id;
  }

  // ======================
  // CHECK STOCK (PER OUTLET)
  // ======================
  const existingStock = await checkStockExistsByItemId(itemId, outlet.id);
  if (existingStock) {
    await reply(chatId, `⚠️ ITEM DAH ADA DI OUTLET`);
    return res.end();
  }

  // ======================
  // INSERT STOCK
  // ======================
  const { error: stockError } = await insertStock({
    item,
    itemId,
    outletId: outlet.id,
    minQty,
    cost,
    uom,
    tenantId
  });

  if (stockError) {
    await reply(chatId, "❌ DB ERROR (STOCK)");
    return res.end();
  }

  await reply(chatId, `✅ ITEM ADDED\n\n${item}\nOutlet: ${outlet.name}\nCategory: ${category}\nMin: ${minQty}\nCost: RM${cost}\nUOM: ${uom}`);
  return res.end();
});