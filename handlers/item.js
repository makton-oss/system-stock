const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatItemListAdmin, formatItemList } = require("../utils/formatter");

module.exports = withRole(["manager","admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

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
        stock_items(name, cost_price, uom),
        outlets(name)
      `)
      .order("outlet_id", { ascending: true });

    if (error) {
      console.log("ITEM ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    await reply(chatId, formatItemListAdmin(data));
    return res.end();
  }

  // ======================
  // STAFF / MANAGER
  // ======================
  const { data, error } = await supabase
    .from("stock")
    .select(`
      item,
	  min_qty,
      stock_items(name, cost_price, uom),
      outlets(name)
    `)
    .eq("outlet_id", user.outlet_id);

  if (error) {
    console.log("ITEM ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  await reply(chatId, formatItemList(data));
  return res.end();
});