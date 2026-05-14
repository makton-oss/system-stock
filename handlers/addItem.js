const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { normalizeItem } = require("../utils/helpers");

module.exports = withRole(["admin", "manager"], async (ctx) => {
  const { chatId, parts, user, reply, res } = ctx;

  const item = normalizeItem(parts[1]);
  const category = parts[2];
  const minQty = parseInt(parts[3]);
  const cost = parseFloat(parts[4]);

  if (!item || !category || isNaN(minQty) || isNaN(cost)) {
    await reply(chatId, "❌ FORMAT: ADDITEM ayam poultry 5 12.50");
    return res.end();
  }

  const { error } = await supabase.from("stock_items").insert({
    name: item,
    category,
    min_qty: minQty,
    cost_price: cost
  });

  if (error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  await reply(chatId, `✅ ITEM ADDED: ${item}`);
  return res.end();
});