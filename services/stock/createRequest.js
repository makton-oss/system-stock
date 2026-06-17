const supabase = require("../db");
const { getStockByItem } = require("../../db/stock/getStockByItem");

async function createRequest({ item, qty, type, user, chatId, validateOnly = false }) {

  const tenantId = user.tenant_id || null;

  // ======================
  // ❌ QTY GUARD
  // ======================
  if (!qty || qty <= 0) {
    return { error: "INVALID_QTY" };
  }

  const stock = await getStockByItem(item, user.outlet_id, tenantId);

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
      requested_by: chatId,
      tenant_id: tenantId
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