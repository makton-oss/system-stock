const supabase = require("../db");

async function createInventorySnapshot() {

  // ======================
  // SNAPSHOT DATE
  // ======================

  const now = new Date();

  const snapshotDate =
    now.toISOString().split("T")[0];

  // ======================
  // PERIOD MONTH
  // snapshot 1 may = april closing
  // ======================

  const prevMonthDate =
    new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

  const month =
    prevMonthDate
      .toLocaleString("en-MY", {
        month: "short"
      })
      .toLowerCase();

  const year =
    prevMonthDate
      .getFullYear()
      .toString()
      .slice(-2);

  const periodMonth =
    `${month}-${year}`;

  // ======================
  // FETCH STOCK
  // ======================

  const { data, error } =
    await supabase
      .from("stock")
      .select(`
        qty,
        cost_price,
        outlet_id,
        item_id,
        item
      `);

  if (error) {
    throw error;
  }

  // ======================
  // BUILD SNAPSHOT
  // ======================

  const rows = data.map(r => ({

    snapshot_date:
      snapshotDate,

    period_month:
      periodMonth,

    outlet_id:
      r.outlet_id,

    item_id:
      r.item_id,

    item_name:
      r.item,

    qty:
      Number(r.qty || 0),

    cost_price:
      Number(r.cost_price || 0),

    inventory_value:
      Number(r.qty || 0) *
      Number(r.cost_price || 0)
  }));

  // ======================
  // UPSERT
  // ======================

  const {
    error: upsertError
  } = await supabase
    .from("stock_snapshots")
    .upsert(rows, {
      onConflict:
        "period_month,outlet_id,item_id"
    });

  if (upsertError) {
    throw upsertError;
  }

  console.log(
    "SNAPSHOT SAVED:",
    periodMonth,
    rows.length
  );
}

module.exports = {
  createInventorySnapshot
};