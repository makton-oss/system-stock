const supabase = require("../../services/db");

async function deleteStockByItem(item, outletId) {
  // ⚠️ item_stock tiada tenant_id — filter by outlet_id sahaja
  const { error } = await supabase
    .from("item_stock")              // ✅ betul
    .delete()
    .eq("item", item)
    .eq("outlet_id", outletId);

  if (error) console.log("DELETE_STOCK_BY_ITEM ERROR:", error);
  return { error };
}

module.exports = { deleteStockByItem };