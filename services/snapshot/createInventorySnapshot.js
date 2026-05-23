const supabase = require("../db");

async function createInventorySnapshot() {

  // ======================
  // TODAY
  // ======================

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  // ======================
  // GET LIVE STOCK
  // ======================

  const {
    data: stocks,
    error
  } = await supabase
    .from("stock")
    .select(`
      item_id,
      outlet_id,
      item,
      qty,
      cost_price
    `);

  if (error) {

    console.log(
      "SNAPSHOT FETCH ERROR:",
      error
    );

    return;
  }

  if (!stocks?.length) {
    return;
  }

  // ======================
  // BUILD SNAPSHOT
  // ======================

  const rows = stocks.map(s => ({

    snapshot_date: today,

    outlet_id:
      s.outlet_id,

    item_id:
      s.item_id,

    item:
      s.item,

    qty:
      Number(s.qty || 0),

    cost_price:
      Number(s.cost_price || 0),

    inventory_value:
      Number(s.qty || 0) *
      Number(s.cost_price || 0)
  }));

  // ======================
  // INSERT
  // ======================

  const {
    error: insertError
    } = await supabase
    .from("stock_snapshots")
    .upsert(rows, {
        onConflict:
        "snapshot_date,outlet_id,item_id"
    });

  if (insertError) {

    console.log(
      "SNAPSHOT INSERT ERROR:",
      insertError
    );

    return;
  }

  console.log(
    `SNAPSHOT CREATED: ${rows.length}`
  );
}

module.exports = {
  createInventorySnapshot
};