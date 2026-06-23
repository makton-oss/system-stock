const supabase = require("../db");
const { applyTenant } = require("../../utils/applyTenant");
const { applyDailyNetting } = require("../../utils/movementNetting");

async function getUsageReport({ start, end, outletIds, tenantId }) {

  let q = supabase
    .from("movements")
    .select(`qty, type, cost_price, outlet_id, item, created_at, outlets(name)`)
    .in("type", ["in", "out"])   // ✅ "in" diperlukan untuk netting; difilter selepas
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: true });

  if (outletIds) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);

  const { data: rawData, error } = await q;
  if (error) return { error };

  const data = applyDailyNetting(rawData);

  const outletMap = new Map();

  data.forEach(r => {
    const outletId   = r.outlet_id || 9999;
    const outletName = r.outlets?.name || "Outlet";

    if (!outletMap.has(outletId)) {
      outletMap.set(outletId, { outletId, outletName, total: 0, itemMap: {} });
    }

    const o     = outletMap.get(outletId);
    const value = Number(r.qty || 0) * Number(r.cost_price || 0);

    if (r.type === "out") {
      o.total += value;
      o.itemMap[r.item] = (o.itemMap[r.item] || 0) + value;
    } else if (r.type === "in" && r.isCorrection) {
      o.total -= value;
      o.itemMap[r.item] = (o.itemMap[r.item] || 0) - value;
    }
    // type "in" yang genuine (!isCorrection) sengaja diabaikan —
    // report ni khusus usage, bukan stock-in
  });

  const result = [...outletMap.values()].sort((a,b) => a.outletId - b.outletId);

  result.forEach(o => {
    o.items = Object.entries(o.itemMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    delete o.itemMap;
  });

  return result;
}

module.exports = { getUsageReport };