const supabase = require("../db");
const { applyTenant } = require("../../utils/applyTenant");
const { getOutletByCode } = require("../../db/outlets/getOutletByCode");

async function updateStockItem({ item, outletName, updates, tenantId = null }) {

  const outlet = await getOutletByCode(outletName, tenantId);

  if (!outlet) {
    return { error: "OUTLET_NOT_FOUND", outlet: outletName };
  }

  let q = supabase
    .from("item_stock")
    .update(updates)
    .eq("item", item)
    .eq("outlet_id", outlet.id)
    .eq("is_active", true);

  q = applyTenant(q, tenantId);

  const { data, error } = await q.select("cost_price, min_qty");

  if (error) {
    console.log("UPDATEITEM ERROR:", error);
    return { error: "DB_ERROR" };
  }

  if (!data?.length) {
    return { error: "ITEM_NOT_FOUND", item, outlet: outlet.name };
  }

  return { ok: true, item, outlet: outlet.name, updated: data[0] };
}

module.exports = { updateStockItem };