const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getLowStockSnapshot({ outletIds, tenantId, snapshotDate }) {
  let snapQ = supabase
    .from("snapshots")
    .select("item_id, item_name, qty, outlet_id, outlets(name)")
    .eq("snapshot_date", snapshotDate);

  if (outletIds) snapQ = snapQ.in("outlet_id", outletIds);
  snapQ = applyTenant(snapQ, tenantId);

  const { data: snaps, error } = await snapQ;
  if (error) return { error };
  if (!snaps?.length) return { items: [] };

  const itemIds = [...new Set(snaps.map(s => s.item_id))];

  let stockQ = supabase
    .from("item_stock")
    .select("item_id, outlet_id, min_qty")
    .in("item_id", itemIds)
    .eq("is_active", true);

  if (outletIds) stockQ = stockQ.in("outlet_id", outletIds);

  const { data: stocks, error: stockError } = await stockQ;
  if (stockError) return { error: stockError };

  const minMap = {};
  stocks.forEach(s => { minMap[`${s.item_id}-${s.outlet_id}`] = s.min_qty; });

  const lowItems = snaps
    .map(s => ({ ...s, min_qty: minMap[`${s.item_id}-${s.outlet_id}`] ?? null }))
    .filter(s => s.min_qty !== null && s.min_qty > 0 && Number(s.qty) <= Number(s.min_qty));

  return { items: lowItems };
}

module.exports = { getLowStockSnapshot };