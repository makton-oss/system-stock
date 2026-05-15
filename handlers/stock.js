const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatStock, formatStockAdmin } = require("../utils/formatter");

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
		  stock_items(name, category, cost_price)
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

	  const { data, error } = await supabase
	  .from("stock")
	  .select(`
		qty,
		item,
		min_qty,
		outlets(name),
		stock_items(name, category, cost_price)
	  `)
	  .eq("outlet_id", user.outlet_id);

	if (error) {
	  console.log("STOCK ERROR:", error);
	  await reply(chatId, "❌ ERROR");
	  return res.end();
	}

	await reply(chatId, formatStock(data));
	return res.end();
});