const { withRole } = require("../core/withRole");
const supabase = require("../services/db");

module.exports = withRole(["manager","admin"], async (ctx) => {

  const { chatId, reply, res } = ctx;

  const { data } = await supabase
    .from("stock_items")
    .select("*");

  let text = "📦 ITEM LIST\n\n";

  data.forEach(i => {
    text += `${i.name}\n`;
  });

  await reply(chatId, text);
  return res.end();
});