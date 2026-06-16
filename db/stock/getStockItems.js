const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getStockNameList(outletId, tenantId = null) {
  // ⚠️ item_stock tiada tenant_id — outlet_id sudah cukup scope
  const { data, error } = await supabase
    .from("item_stock")       // ✅ fix: stock → item_stock
    .select("item, uom")
    .eq("outlet_id", outletId)
    .order("item", { ascending: true });

  if (error) console.log("GET_STOCK_NAME_LIST ERROR:", error);
  return data || [];
}

async function getStockConfig(outletIds, tenantId = null) {
  // ⚠️ item_stock tiada tenant_id — outletIds sudah cukup scope
  const { data, error } = await supabase
    .from("item_stock")       // ✅ fix: stock → item_stock
    .select(`item, min_qty, outlet_id, cost_price, uom, items(name), outlets(name)`)
    .in("outlet_id", outletIds)   // ✅ fix: stock_items → items
    .order("outlet_id", { ascending: true })
    .order("item",      { ascending: true });

  if (error) console.log("GET_STOCK_CONFIG ERROR:", error);
  return data || [];
}

module.exports = { getStockNameList, getStockConfig };