const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getStockItemByName(name, tenantId = null) {
  let q = supabase
    .from("items")                   // ✅ betul — bukan stock_items
    .select("id")
    .eq("name", name);

  q = applyTenant(q, tenantId);     // items ada tenant_id ✅

  const { data, error } = await q.maybeSingle();
  if (error) console.log("GET_STOCK_ITEM_BY_NAME ERROR:", error);
  return data || null;
}

async function createStockItem(name, category, tenantId = null) {
  const { data, error } = await supabase
    .from("items")                   // ✅ betul
    .insert({ name, category, tenant_id: tenantId })
    .select()
    .single();

  if (error) console.log("CREATE_STOCK_ITEM ERROR:", error);
  return { data, error };
}

async function checkStockExistsByItemId(itemId, outletId) {
  const { data, error } = await supabase
    .from("item_stock")              // ✅ betul — bukan stock
    .select("id")
    .eq("item_id", itemId)
    .eq("outlet_id", outletId)
    .maybeSingle();

  if (error) console.log("CHECK_STOCK_EXISTS ERROR:", error);
  return data || null;
}

async function insertStock({ item, itemId, outletId, minQty, cost, uom }) {
  // ⚠️ item_stock TIADA tenant_id — jangan pass, akan error
  const { error } = await supabase
    .from("item_stock")              // ✅ betul
    .insert({
      item,
      item_id:    itemId,
      outlet_id:  outletId,
      qty:        0,
      min_qty:    minQty,
      cost_price: cost,
      uom
    });

  if (error) console.log("INSERT_STOCK ERROR:", error);
  return { error };
}

module.exports = {
  getStockItemByName,
  createStockItem,
  checkStockExistsByItemId,
  insertStock
};