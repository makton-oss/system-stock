const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatItemList } = require("../utils/formatter");

module.exports = withRole(["manager","admin"], async (ctx) => {

  const { chatId, reply, res } = ctx;

  const { data } = await supabase
	  .from("stock_items")
	  .select("name, outlets(name)")
	  .eq("outlet_id", ctx.user.outlet_id);

  await reply(chatId, formatItemList(data));
  
  return res.end();
});