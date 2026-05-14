const supabase = require("./db");

async function getStock(item, outletId) {
  return supabase
    .from("stock")
    .select("*")
    .eq("item", item)
    .eq("outlet_id", outletId)
    .maybeSingle();
}

module.exports = { getStock };