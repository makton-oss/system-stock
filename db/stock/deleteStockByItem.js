const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function deleteStockByItem(item, outletId, tenantId = null) {

  let q = supabase
    .from("item_stock")
    .update({ is_active: false })
    .eq("item", item)
    .eq("outlet_id", outletId);

  q = applyTenant(q, tenantId);

  const { error } = await q;

  if (error) console.log("DELETE_STOCK_BY_ITEM ERROR:", error);
  return { error };
}

module.exports = { deleteStockByItem };