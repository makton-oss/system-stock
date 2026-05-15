const supabase = require("./db");

async function approveRequests(rows, chatId) {

  let summary = {};
  let logDetails = [];

  for (const row of rows) {

    // ======================
    // 🔥 LOCK ROW (ANTI DOUBLE APPROVE)
    // ======================
    const { data: updated } = await supabase
      .from("requests")
      .update({
        status: "approved",
        processed_by: chatId,
        processed_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .eq("status", "pending") // 🔥 critical lock
      .select();

    // kalau dah approve by orang lain → skip
    if (!updated?.length) continue;

    // ======================
    // GET BEFORE STOCK
    // ======================
    const { data: before } = await supabase
      .from("stock")
      .select("qty, stock_items(min_qty)")
      .eq("item_id", row.item_id)
      .eq("outlet_id", row.outlet_id)
      .maybeSingle();

    if (!before) continue;

    // ======================
    // UPDATE STOCK (RPC)
    // ======================
    if (row.type === "out") {

	  const { data, error } = await supabase.rpc("decrease_stock", {
		p_item_id: row.item_id, // 🔥 FIX SINI
		p_qty: row.qty,
		p_outlet_id: row.outlet_id
	  });

	  console.log("DECREASE RESULT:", data, error);

	} else {

	  const { data, error } = await supabase.rpc("increase_stock", {
		p_item_id: row.item_id, // 🔥 FIX SINI
		p_qty: row.qty,
		p_outlet_id: row.outlet_id
	  });

	  console.log("INCREASE RESULT:", data, error);
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
      created_by: chatId
    });

    // ======================
    // GET AFTER STOCK
    // ======================
    const { data: after } = await supabase
      .from("stock")
      .select("qty, stock_items(min_qty)")
      .eq("item_id", row.item_id)
      .eq("outlet_id", row.outlet_id)
      .maybeSingle();

    const minQty = after?.stock_items?.min_qty || 0;

    // ======================
    // LOW STOCK CHECK
    // ======================
    const isLow =
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

module.exports = { approveRequests };