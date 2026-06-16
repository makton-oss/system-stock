const supabase = require("../db");
const { DateTime } = require("luxon");

async function createInventorySnapshot(tenantId = null) {

  // ======================
  // IF NO TENANT, FETCH ALL ACTIVE TENANTS
  // ======================
  if (!tenantId) {
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("is_active", true);

    if (error) {
      console.log("SNAPSHOT TENANT FETCH ERROR:", error);
      return;
    }

    for (const tenant of tenants) {
      await createInventorySnapshot(tenant.id);
    }
    return;
  }

  const snapshotDate = DateTime
    .now()
    .setZone("Asia/Kuala_Lumpur")
    .toFormat("yyyy-MM-dd");

  let q = supabase
    .from("item_stock")
    .select(`qty, outlet_id, item_id, item, cost_price, outlets(tenant_id)`);

  q = q.eq("outlets.tenant_id", tenantId);

  const { data: stocks, error } = await q;

  if (error) {
    console.log("SNAPSHOT FETCH ERROR:", error);
    return;
  }

  const rows = stocks
    .filter(s => s.outlets?.tenant_id === tenantId)
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
        tenant_id:       tenantId  // ← always set, never null
      };
    });

  if (!rows.length) {
    console.log(`⚠️ SNAPSHOT: no data for tenant ${tenantId}`);
    return;
  }

  const { error: saveError } = await supabase
    .from("snapshots")
    .upsert(rows, {
      onConflict: "snapshot_date,outlet_id,item_id"
    });

  if (saveError) {
    console.log(`SNAPSHOT SAVE ERROR [tenant: ${tenantId}]:`, saveError);
    return;
  }

  console.log(`✅ SNAPSHOT SAVED (${snapshotDate}) [tenant: ${tenantId}] — ${rows.length} rows`);
}

module.exports = { createInventorySnapshot };