const supabase = require("../db");

async function approveRequest(rows, chatId) {

  let summary = {};
  let logDetails = [];

  for (const row of rows) {

    // ======================
    // 🔥 ATOMIC LOCK
    // ======================
    const { data: updated } = await supabase
      .from("requests")
      .update({
        status: "approved",
        processed_by: chatId,
        processed_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select();

    // skip kalau dah kena process
    if (!updated?.length) continue;

    // ======================
    // GET STOCK (FIXED)
    // ======================
    const { data: before } = await supabase
      .from("stock")
      .select("qty, min_qty, cost_price")
      .eq("item_id", row.item_id)
      .eq("outlet_id", row.outlet_id)
      .maybeSingle();

    if (!before) {
      console.log("STOCK NOT FOUND:", row.item_id, row.outlet_id);
      continue;
    }

    // ======================
    // UPDATE STOCK (RPC)
    // ======================
    let rpcRes;

    if (row.type === "out" || row.type === "wastage") {
      rpcRes = await supabase.rpc("decrease_stock", {
        p_item_id: row.item_id,
        p_qty: row.qty,
        p_outlet_id: row.outlet_id
      });
    } else {
      rpcRes = await supabase.rpc("increase_stock", {
        p_item_id: row.item_id,
        p_qty: row.qty,
        p_outlet_id: row.outlet_id
      });
    }

    if (rpcRes.error) {
      console.log("RPC ERROR:", rpcRes.error);
      continue;
    }

    // ======================
    // INSERT MOVEMENT
    // ======================
    await supabase.from("stock_movements").insert({
      outlet_id: row.outlet_id,
      item_id: row.item_id,
      request_id: row.id,
      item: row.item,
      qty: row.qty,
      type: row.type,
	  cost_price: before.cost_price || 0,
      created_by: chatId
    });

    // ======================
    // AFTER STOCK
    // ======================
    const { data: after } = await supabase
      .from("stock")
      .select("qty, min_qty, cost_price")
      .eq("item_id", row.item_id)
      .eq("outlet_id", row.outlet_id)
      .maybeSingle();

    const minQty = after?.min_qty || 0;

    // FIX — add type guard
    const isLow =
      (row.type === "out" || row.type === "wastage") &&
      before.qty > minQty &&
      after.qty <= minQty;

    // ======================
    // SUMMARY
    // ======================
    summary[row.item] =
      (summary[row.item] || 0) +
      (row.type === "out" ? -row.qty : row.qty);

    logDetails.push(`ID${row.id} ${row.item}`);

    if (isLow) {
      row._lowStock = {
        item: row.item,
        qty: after.qty,
        min: minQty,
        outlet_id: row.outlet_id
      };
    }
  }

  return { summary, logDetails, rows };
}

module.exports = { approveRequest };