const supabase = require("./db");

async function createRequest({ item, qty, type, user, chatId }) {

  const { data: stock } = await supabase
    .from("stock")
    .select("*")
    .eq("outlet_id", user.outlet_id)
    .eq("item", item)
    .maybeSingle();

  if (!stock) return { error: "ITEM_NOT_FOUND" };

  const { error } = await supabase
    .from("requests")
    .insert({
      item,
      item_id: stock.item_id,
      qty,
      status: "processing",
      type,
      outlet_id: user.outlet_id,
      requested_by: chatId
    });

  if (error) return { error };

  return { success: true };
}

module.exports = { createRequest };