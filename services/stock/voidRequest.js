const supabase = require("../db");
const { withOutletLock } = require("../../db/requests/outletLock");

// ======================
// VOID APPROVED REQUEST
// - reverse stock movement (in -> decrease, out/wastage -> increase)
// - insert reversal movement row for audit trail
// - mark request as voided
// ======================
async function voidRequest({ requestId, tenantId, voidedBy }) {

  const { data: request, error: reqError } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (reqError) return { error: "DB_ERROR" };
  if (!request) return { error: "NOT_FOUND" };

  // tenant scoping — superadmin passes tenantId=null (bypass)
  if (tenantId && request.tenant_id !== tenantId) {
    return { error: "NO_ACCESS" };
  }

  if (request.status !== "approved") {
    return { error: "NOT_APPROVED", currentStatus: request.status };
  }

  return await withOutletLock(request.outlet_id, async () => {

    // ======================
    // RE-CHECK INSIDE LOCK — anti double-void race
    // ======================
    const { data: fresh } = await supabase
      .from("requests")
      .select("status")
      .eq("id", requestId)
      .maybeSingle();

    if (!fresh || fresh.status !== "approved") {
      return { error: "ALREADY_PROCESSED" };
    }

    const { data: movements, error: movError } = await supabase
      .from("movements")
      .select("*")
      .eq("request_id", requestId);

    if (movError) return { error: "DB_ERROR" };

    // ======================
    // NO MOVEMENT FOUND (edge case) — void status only, no stock change
    // ======================
    if (!movements?.length) {
      await supabase
        .from("requests")
        .update({ status: "voided", voided_by: voidedBy, voided_at: new Date().toISOString() })
        .eq("id", requestId);

      return { ok: true, request, results: [], note: "NO_MOVEMENT_FOUND" };
    }

    const results = [];

    for (const mv of movements) {

      const { data: stockBefore } = await supabase
        .from("item_stock")
        .select("qty, min_qty")
        .eq("item_id", mv.item_id)
        .eq("outlet_id", mv.outlet_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!stockBefore) {
        results.push({ item: mv.item, reverted: false, reason: "ITEM_INACTIVE_OR_DELETED" });
        continue;
      }

      // reverse direction: original "in" -> decrease; "out"/"wastage" -> increase
      const rpcName = mv.type === "in" ? "decrease_stock" : "increase_stock";

      const rpcRes = await supabase.rpc(rpcName, {
        p_item_id:  mv.item_id,
        p_qty:      mv.qty,
        p_outlet_id: mv.outlet_id
      });

      if (rpcRes.error) {
        console.log("VOID RPC ERROR:", rpcRes.error);
        results.push({ item: mv.item, reverted: false, reason: "RPC_ERROR" });
        continue;
      }

      const { data: stockAfter } = await supabase
        .from("item_stock")
        .select("qty")
        .eq("item_id", mv.item_id)
        .eq("outlet_id", mv.outlet_id)
        .eq("is_active", true)
        .maybeSingle();

      // audit trail — insert opposite-type movement, linked to original
      const reversalType = mv.type === "in" ? "out" : "in";

      await supabase.from("movements").insert({
        outlet_id:  mv.outlet_id,
        item_id:    mv.item_id,
        request_id: mv.request_id,
        item:       mv.item,
        qty:        mv.qty,
        type:       reversalType,
        cost_price: mv.cost_price,
        created_by: voidedBy,
        tenant_id:  mv.tenant_id,
        reversal_of_movement_id: mv.id
      });

      results.push({
        item:      mv.item,
        reverted:  true,
        beforeQty: stockBefore.qty,
        afterQty:  stockAfter?.qty ?? null
      });
    }

    await supabase
      .from("requests")
      .update({ status: "voided", voided_by: voidedBy, voided_at: new Date().toISOString() })
      .eq("id", requestId);

    return { ok: true, request, results };
  });
}

module.exports = { voidRequest };