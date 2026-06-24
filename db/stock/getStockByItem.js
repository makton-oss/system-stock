const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getStockByItem(item, outletId, tenantId = null) {
  let q = supabase
    .from("item_stock")
    .select("*")
    .eq("item", item)
    .eq("outlet_id", outletId)
    .eq("is_active", true);

  q = applyTenant(q, tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) console.log("GET_STOCK_BY_ITEM ERROR:", error);
  return data || null;
}

module.exports = { getStockByItem };