const { getStockItemByName, createStockItem, checkStockExistsByItemId, insertStock } = require("../../db/stock/manageStockItem");

// ======================
// ADD ITEM TO OUTLET (shared logic)
// Dipakai oleh: handlers/addItem.js + scripts/bulkImportItems.js
//
// Flow:
// 1. Semak master (table: items) by name + tenant
// 2. Ada → reuse id sedia ada
//    Tiada → create baru, pass id baru
// 3. Semak duplicate di item_stock (item_id + outlet_id)
// 4. Insert item_stock guna itemId yang resolved
// ======================
async function addStockItem({ item, category, minQty, cost, uom, outlet, tenantId }) {

  // ======================
  // CHECK / CREATE STOCK ITEM (MASTER)
  // ======================
  let itemId;
  const existingItem = await getStockItemByName(item, tenantId);

  if (existingItem) {
    itemId = existingItem.id;
  } else {
    const { data: newItem, error: itemError } = await createStockItem(item, category, tenantId);
    if (itemError) return { error: "ITEM_DB_ERROR" };
    itemId = newItem.id;
  }

  // ======================
  // CHECK STOCK (PER OUTLET)
  // ======================
  const existingStock = await checkStockExistsByItemId(itemId, outlet.id);
  if (existingStock) {
    return { error: "STOCK_EXISTS" };
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

  if (stockError) return { error: "STOCK_DB_ERROR" };

  return { ok: true, item, outlet: outlet.name };
}

module.exports = { addStockItem };