const supabase = require("../db");
const { applyTenant } = require("../../utils/applyTenant");

async function getUsageReport({ start, end, outletIds, tenantId }) {

  let q = supabase
    .from("movements")        // ✅ fix: stock_movements → movements
    .select(`qty, type, cost_price, outlet_id, item, outlets(name)`)
    .eq("type", "out")
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) return { error };

  const outletMap = new Map();

  data.forEach(r => {
    const outletId   = r.outlet_id || 9999;
    const outletName = r.outlets?.name || "Outlet";

    if (!outletMap.has(outletId)) {
      outletMap.set(outletId, { outletId, outletName, total: 0, itemMap: {} });
    }

    const o     = outletMap.get(outletId);
    const value = Number(r.qty || 0) * Number(r.cost_price || 0);

    o.total += value;
    o.itemMap[r.item] = (o.itemMap[r.item] || 0) + value;
  });

  const result = [...outletMap.values()].sort((a,b) => a.outletId - b.outletId);

  result.forEach(o => {
    o.items = Object.entries(o.itemMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    delete o.itemMap;
  });

  return result;
}

module.exports = { getUsageReport };