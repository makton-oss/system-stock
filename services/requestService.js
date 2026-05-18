const supabase = require("./db");

async function createRequest({ item, qty, type, user, chatId, validateOnly = false }) {

  const { data: stock } = await supabase
    .from("stock")
    .select("*")
    .eq("outlet_id", user.outlet_id)
    .eq("item", item)
    .maybeSingle();

  // ======================
  // ❌ ITEM NOT FOUND
  // ======================
  if (!stock) return { error: "ITEM_NOT_FOUND" };

  // ======================
  // 🔍 VALIDATION MODE ONLY
  // ======================
  if (validateOnly) {
    return { ok: true };
  }

  // ======================
  // 🚀 INSERT
  // ======================
  const { data, error } = await supabase
    .from("requests")
    .insert({
      item,
      item_id: stock.item_id,
      qty,
      status: "pending",
      type,
      outlet_id: user.outlet_id,
      requested_by: chatId
    })
    .select()
    .single();

  if (error) return { error };

  return {
    id: data.id,
    item,
    qty
  };
}

module.exports = { createRequest };