const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatStock } = require("../utils/formatter");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {
  const { chatId, user, reply, res } = ctx;

  const { data } = await supabase
    .from("stock")
    .select("*, outlets(name), stock_items(*)")
    .eq("outlet_id", user.outlet_id);

  await reply(chatId, formatStock(data));
  return res.end();
});