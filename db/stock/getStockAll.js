const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");   // ✅ tambah import

async function getStockAll(outletIds = null, tenantId = null) {
  let q = supabase
    .from("item_stock")
    .select(`
      qty, item, min_qty, outlet_id,
      cost_price, uom,
      outlets(name),
      items(name, category)   
    `)
    .eq("is_active", true)
    .order("outlet_id", { ascending: true })
    .order("item",      { ascending: true });

  if (outletIds) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);   // ✅ FIX — close leak bila outletIds null (admin)

  const { data, error } = await q;
  if (error) console.log("GET_STOCK_ALL ERROR:", error);
  return data || [];
}

module.exports = { getStockAll };