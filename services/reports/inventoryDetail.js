const supabase = require("../db");
const { applyTenant } = require("../../utils/applyTenant");

// ======================
// FLAT ITEM LIST — per outlet, satu snapshot date
// Termasuk item qty 0 (snapshot dah capture semua active item_stock)
// ======================
async function getInventoryDetailByOutlet({ outletId, snapshotDate, tenantId }) {

  let snapQ = supabase
    .from("snapshots")
    .select("item_id, item_name, qty, cost_price, inventory_value")
    .eq("outlet_id", outletId)
    .eq("snapshot_date", snapshotDate);

  snapQ = applyTenant(snapQ, tenantId);

  const { data: snaps, error: snapError } = await snapQ;
  if (snapError) return { error: snapError };
  if (!snaps?.length) return { items: [] };

  const itemIds = [...new Set(snaps.map(s => s.item_id))];

  // category — master table "items"
  const { data: items, error: itemError } = await supabase
    .from("items")
    .select("id, category")
    .in("id", itemIds);

  if (itemError) return { error: itemError };

  const categoryMap = {};
  items.forEach(i => { categoryMap[i.id] = i.category || "Lain-lain"; });

  // uom — "item_stock" tak disimpan dalam snapshot, kena fetch current value
  const { data: stocks, error: stockError } = await supabase
    .from("item_stock")
    .select("item_id, uom")
    .eq("outlet_id", outletId)
    .in("item_id", itemIds);

  if (stockError) return { error: stockError };

  const uomMap = {};
  stocks.forEach(s => { uomMap[s.item_id] = s.uom || "-"; });

  const rows = snaps.map(s => {
    const qty   = Number(s.qty || 0);
    const price = Number(s.cost_price || 0);
    return {
      name:     s.item_name,
      category: categoryMap[s.item_id] || "Lain-lain",
      uom:      uomMap[s.item_id] || "-",
      price,
      qty,
      total: s.inventory_value != null ? Number(s.inventory_value) : qty * price
    };
  });

  return { items: rows };
}

module.exports = { getInventoryDetailByOutlet };