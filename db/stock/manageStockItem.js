const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");
const { normalizeItem } = require("../../utils/helpers");

async function getStockItemByName(name, tenantId = null) {
  const normalized = normalizeItem(name);  // ← normalize, then exact match

  let q = supabase
    .from("items")
    .select("id, name")
    .eq("name", normalized);

  q = applyTenant(q, tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) console.log("GET_STOCK_ITEM_BY_NAME ERROR:", error);
  return data || null;
}

async function createStockItem(name, category, tenantId = null) {
  const normalized = normalizeItem(name);  // ← normalize before insert

  const { data, error } = await supabase
    .from("items")
    .insert({ name: normalized, category, tenant_id: tenantId })
    .select()
    .single();

  if (error) console.log("CREATE_STOCK_ITEM ERROR:", error);
  return { data, error };
}

async function checkStockExistsByItemId(itemId, outletId) {
  const { data, error } = await supabase
    .from("item_stock")
    .select("id")
    .eq("item_id", itemId)
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) console.log("CHECK_STOCK_EXISTS ERROR:", error);
  return data || null;
}

async function insertStock({ item, itemId, outletId, minQty, cost, uom, tenantId = null }) {
  const normalized = normalizeItem(item);  // ← normalize string copy too

  const payload = {
    item:       normalized,
    item_id:    itemId,
    outlet_id:  outletId,
    qty:        0,
    min_qty:    minQty,
    cost_price: cost,
    uom
  };

  // only add tenant_id if column exists in item_stock
  // remove this line if item_stock has no tenant_id column
  if (tenantId) payload.tenant_id = tenantId;

  const { error } = await supabase
    .from("item_stock")
    .insert(payload);

  if (error) console.log("INSERT_STOCK ERROR:", error);
  return { error };
}

module.exports = {
  getStockItemByName,
  createStockItem,
  checkStockExistsByItemId,
  insertStock
};