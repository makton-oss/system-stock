const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatStock, formatStockAdmin } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

  if (user.role === "admin") {

    const { data, error } = await supabase
      .from("stock")
      .select(`
        qty,
        item,
        min_qty,
        outlet_id,
        outlets(name),
        stock_items(name, category, cost_price, uom)
      `)
      .order("outlet_id", { ascending: true });

    if (error) {
      console.log("STOCK ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    await reply(chatId, formatStockAdmin(data));
    return res.end();
  }

  const outletIds = await getAccessibleOutletIds(user);

  const { data, error } = await supabase
    .from("stock")
    .select(`
      qty,
      item,
      min_qty,
      outlet_id,
      outlets(name),
      stock_items(name, category, cost_price, uom)
    `)
    .in("outlet_id", outletIds)
    .order("outlet_id", { ascending: true });

  if (error) {
    console.log("STOCK ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  await reply(chatId, formatStock(data));
  return res.end();
});