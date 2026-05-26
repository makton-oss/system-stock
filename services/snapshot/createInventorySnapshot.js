const supabase = require("../db");
const { DateTime } = require("luxon");

async function createInventorySnapshot() {

  // ======================
  // SNAPSHOT DATE (daily)
  // ======================
  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");
  const snapshotDate = now.toFormat("yyyy-MM-dd");
  const periodMonth = now.toFormat("MMM-yy").toLowerCase(); // "may-26"

  // ======================
  // FETCH STOCK
  // ======================
  const { data, error } = await supabase
    .from("stock")
    .select(`
      qty,
      cost_price,
      outlet_id,
      item_id,
      item
    `);

  if (error) throw error;

  // ======================
  // BUILD SNAPSHOT
  // ======================
  const rows = data.map(r => ({
    snapshot_date: snapshotDate,
    period_month: periodMonth,
    outlet_id: r.outlet_id,
    item_id: r.item_id,
    item_name: r.item,
    qty: Number(r.qty || 0),
    cost_price: Number(r.cost_price || 0),
    inventory_value: Number(r.qty || 0) * Number(r.cost_price || 0)
  }));

  // ======================
  // UPSERT (by date now)
  // ======================
  const { error: upsertError } = await supabase
    .from("stock_snapshots")
    .upsert(rows, {
      onConflict: "snapshot_date,outlet_id,item_id"  // ← changed
    });

  if (upsertError) throw upsertError;

  console.log("SNAPSHOT SAVED:", snapshotDate, periodMonth, rows.length);
}

module.exports = {
  createInventorySnapshot
};