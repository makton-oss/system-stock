const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getWatchlistStock(outletIds, tenantId = null) {
  let q = supabase
    .from("item_stock")
    .select(`
      item, qty, uom, min_qty, watch_order,
      outlet_id,
      items(name, category),
      outlets(name)
    `)
    .in("outlet_id", outletIds)
    .eq("is_active", true)
    .not("watch_order", "is", null)
    .order("watch_order", { ascending: true });

  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) console.log("GET_WATCHLIST_STOCK ERROR:", error);
  return data || [];
}

module.exports = { getWatchlistStock };