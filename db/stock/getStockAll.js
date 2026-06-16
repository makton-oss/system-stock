const supabase = require("../../services/db");

async function getStockAll(outletIds = null, tenantId = null) {
  let q = supabase
    .from("item_stock")       // ✅ already correct
    .select(`
      qty, item, min_qty, outlet_id,
      cost_price, uom,
      outlets(name),
      items(name, category)   
    `)                        // ✅ fix: stock_items → items
    .order("outlet_id", { ascending: true })
    .order("item",      { ascending: true });

  if (outletIds) q = q.in("outlet_id", outletIds);
  // ⚠️ item_stock tiada tenant_id — skip applyTenant
  // tenant already scoped via outletIds

  const { data, error } = await q;
  if (error) console.log("GET_STOCK_ALL ERROR:", error);
  return data || [];
}

module.exports = { getStockAll };