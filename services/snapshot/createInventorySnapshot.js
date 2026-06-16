const supabase = require("../db");
const { DateTime } = require("luxon");

async function createInventorySnapshot(tenantId = null) {

  const snapshotDate = DateTime
    .now()
    .setZone("Asia/Kuala_Lumpur")
    .toFormat("yyyy-MM-dd");

  // ⚠️ item_stock tiada tenant_id — filter lain tak boleh pakai
  let q = supabase
    .from("item_stock")       // ✅ fix: stock → item_stock
    .select(`qty, outlet_id, item_id, item, cost_price, outlets(tenant_id)`);

  // Scope by tenant via join outlets
  if (tenantId) {
    q = q.eq("outlets.tenant_id", tenantId);
  }

  const { data: stocks, error } = await q;

  if (error) {
    console.log(error);
    return;
  }

  const rows = stocks
    .filter(s => !tenantId || s.outlets?.tenant_id === tenantId)
    .map(stock => {
      const costPrice = Number(stock.cost_price || 0);
      return {
        snapshot_date:   snapshotDate,
        outlet_id:       stock.outlet_id,
        item_id:         stock.item_id,
        item_name:       stock.item,
        qty:             stock.qty,
        cost_price:      costPrice,
        inventory_value: Number(stock.qty) * costPrice,
        tenant_id:       tenantId
      };
    });

  const { error: saveError } = await supabase
    .from("snapshots")        // ✅ fix: stock_snapshots → snapshots
    .upsert(rows, {
      onConflict: "snapshot_date,outlet_id,item_id"
    });

  if (saveError) {
    console.log(saveError);
    return;
  }

  console.log(`✅ SNAPSHOT SAVED (${snapshotDate})`);
}

module.exports = { createInventorySnapshot };