const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatItemListAdmin, formatItemList, formatItemNameList } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["staff", "supervisor" ,"manager","admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

  // ======================
  // STAFF → SIMPLE NAME LIST (ALPHABET)
  // ======================
  if (["staff", "supervisor"].includes(user.role)) {

    const { data, error } = await supabase
	  .from("stock")
	  .select("item, uom")
	  .eq("outlet_id", user.outlet_id)
	  .order("item", { ascending: true });

    if (error) {
      console.log("ITEM ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    await reply(chatId, formatItemNameList(data));
    return res.end();
  }

  // ======================
  // ADMIN → ALL OUTLETS
  // ======================
  if (user.role === "admin") {

    const { data, error } = await supabase
      .from("stock")
      .select(`
        item,
        outlet_id,
        min_qty,
		cost_price,
		uom,
        stock_items(name),
        outlets(name)
      `)
      .order("outlet_id", { ascending: true })
	  .order("item", { ascending: true });

    if (error) {
      console.log("ITEM ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    await reply(chatId, formatItemListAdmin(data));
    return res.end();
  }

  // ======================
  // MANAGER → MULTI OUTLET
  // ======================
  const outletIds = await getAccessibleOutletIds(user);

  const { data, error } = await supabase
    .from("stock")
    .select(`
      item,
      min_qty,
      outlet_id,
	  cost_price,
	  uom,
      stock_items(name),
      outlets(name)
    `)
    .in("outlet_id", outletIds)
	.order("item", { ascending: true });

  if (error) {
    console.log("ITEM ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  const uniqueOutlet = [...new Set(data.map(r => r.outlet_id))];

  if (uniqueOutlet.length > 1) {
    await reply(chatId, formatItemListAdmin(data));
  } else {
    await reply(chatId, formatItemList(data));
  }

  return res.end();
});