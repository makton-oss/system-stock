const supabase = require("../db");

async function approveRequest(rows, chatId, tenantId) {

  let summary      = {};
  let logDetails   = [];
  let lowStockItems = [];
  let processedCount = 0;

  for (const row of rows) {

    // ======================
    // 🔥 ATOMIC LOCK
    // ======================
    const { data: updated } = await supabase
      .from("requests")
      .update({
        status:       "approved",
        processed_by: chatId,
        processed_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select();

    if (!updated?.length) continue;

    // ======================
    // GET STOCK BEFORE
    // ======================
    const { data: before } = await supabase
      .from("item_stock")
      .select("qty, min_qty, cost_price")
      .eq("item_id", row.item_id)
      .eq("outlet_id", row.outlet_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!before) {
      console.log("STOCK INACTIVE OR NOT FOUND — SKIP:", row.item_id, row.outlet_id);
      // Sengaja tak push ke logDetails — inactive stock bukan success
      continue;
    }

    // ======================
    // UPDATE STOCK (RPC)
    // ======================
    let rpcRes;

    if (row.type === "out" || row.type === "wastage") {
      rpcRes = await supabase.rpc("decrease_stock", {
        p_item_id:  row.item_id,
        p_qty:      row.qty,
        p_outlet_id: row.outlet_id
      });
    } else {
      rpcRes = await supabase.rpc("increase_stock", {
        p_item_id:  row.item_id,
        p_qty:      row.qty,
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
    await supabase.from("movements").insert({
      outlet_id:  row.outlet_id,
      item_id:    row.item_id,
      request_id: row.id,
      item:       row.item,
      qty:        row.qty,
      type:       row.type,
      cost_price: before.cost_price || 0,
      created_by: chatId,
      tenant_id:  tenantId
    });

    // ======================
    // GET STOCK AFTER
    // ======================
    const { data: after } = await supabase
      .from("item_stock")
      .select("qty, min_qty, cost_price")
      .eq("item_id", row.item_id)
      .eq("outlet_id", row.outlet_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!after) {
      console.log("AFTER STOCK NOT FOUND:", row.item_id, row.outlet_id);
      summary[row.item] = {
        qty: (summary[row.item]?.qty || 0) +
          (row.type === "out" || row.type === "wastage" ? -row.qty : row.qty),
        balance: null,
        min: 0
      };
      logDetails.push(`ID${row.id} ${row.item}`);
      processedCount++;
      continue;
    }

    // ======================
    // LOW STOCK CHECK
    // ======================
    const isLow =
      (row.type === "out" || row.type === "wastage") &&
      after.min_qty > 0 &&
      after.qty <= after.min_qty;

    // ======================
    // SUMMARY
    // ======================
    summary[row.item] = {
      qty: (summary[row.item]?.qty || 0) +
        (row.type === "out" || row.type === "wastage" ? -row.qty : row.qty),
      balance: after.qty,
      min:     after.min_qty
    };

    logDetails.push(`ID${row.id} ${row.item}`);
    processedCount++;

    if (isLow) {
      lowStockItems.push({
        item:      row.item,
        qty:       after.qty,
        min:       after.min_qty,
        outlet_id: row.outlet_id
      });
    }
  }

  return { summary, logDetails, rows, lowStockItems, processedCount };
}

module.exports = { approveRequest };