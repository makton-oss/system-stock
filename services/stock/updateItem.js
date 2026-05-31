const supabase = require("../db");
const { getOutletByCode } = require("../../utils/getOutletByCode");

async function updateStockItem({
  item,
  outletName,
  updates
}) {

  // ======================
  // GET OUTLET
  // ======================
  const outlet =
    await getOutletByCode(outletName);

  if (!outlet) {
    return {
      error: "OUTLET_NOT_FOUND",
      outlet: outletName
    };
  }

  // ======================
  // UPDATE STOCK
  // ======================
  const { data, error } =
    await supabase
      .from("stock")
      .update(updates)
      .eq("item", item)
      .eq("outlet_id", outlet.id)
      .select("cost_price, min_qty");

  if (error) {
    console.log("UPDATEITEM ERROR:", error);
    return { error: "DB_ERROR" };
  }

  if (!data?.length) {
    return {
      error: "ITEM_NOT_FOUND",
      item,
      outlet: outlet.name
    };
  }

  return {
    ok: true,
    item,
    outlet: outlet.name,
    updated: data[0]
  };
}

module.exports = { updateStockItem };