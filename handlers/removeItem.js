// services/stock/removeItem.js — REPLACE entire handler

const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { normalizeItem } = require("../utils/helpers");

module.exports = withRole(["admin"], async (ctx) => {
  const { chatId, parts, reply, res } = ctx;

  const item = normalizeItem(parts.slice(1).join(" "));

  if (!item) {
    await reply(chatId, "❌ FORMAT: REMOVEITEM ayam");
    return res.end();
  }

  const { error } = await supabase
    .from("stock")
    .delete()
    .eq("item", item);

  if (error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  await reply(chatId, `✅ ITEM REMOVED: ${item}`);
  return res.end();
});