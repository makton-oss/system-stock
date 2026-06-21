const supabase = require("../db");
const { applyTenant } = require("../../utils/applyTenant");
const { DateTime } = require("luxon");

async function getSummaryReport({ start, end, outletIds, tenantId }) {

  let movementQ = supabase
    .from("movements")
    .select(`qty, type, cost_price, outlet_id, item, outlets(name)`)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds) movementQ = movementQ.in("outlet_id", outletIds);
  movementQ = applyTenant(movementQ, tenantId);

  const { data: movements, error } = await movementQ;
  if (error) return { error };

  // ======================
  // SNAPSHOT DATES — timezone-safe (Luxon), sync dgn createInventorySnapshot.js
  // ======================
  const startKL = DateTime.fromISO(start).setZone("Asia/Kuala_Lumpur");
  const endKL   = DateTime.fromISO(end).setZone("Asia/Kuala_Lumpur");
  const todayKL = DateTime.now().setZone("Asia/Kuala_Lumpur");

  const openingDate = startKL.startOf("month").toFormat("yyyy-MM-dd");

  // Snapshot dijana 23:59 KL — kalau end = hari ini, snapshot belum wujud,
  // fallback ke semalam (closing terakhir yang sah)
  const closingTarget = endKL.hasSame(todayKL, "day")
    ? todayKL.minus({ days: 1 })
    : endKL;
  const closingDate = closingTarget.toFormat("yyyy-MM-dd");
  
  async function fetchSnapshot(date) {
    let q = supabase
      .from("snapshots")
      .select("outlet_id, inventory_value, outlets(name)")
      .eq("snapshot_date", date);

    if (outletIds) q = q.in("outlet_id", outletIds);
    q = applyTenant(q, tenantId);

    const { data } = await q;
    if (!data?.length) return null;

    const map = {};
    data.forEach(r => {
      const id = r.outlet_id;
      map[id] = (map[id] || 0) + Number(r.inventory_value || 0);
    });
    return map;
  }

  const [openingMap, closingMap] = await Promise.all([
    fetchSnapshot(openingDate),
    fetchSnapshot(closingDate)
  ]);

  const outletMap = new Map();

  movements.forEach(r => {
    const outletId   = r.outlet_id || 9999;
    const outletName = r.outlets?.name || "Outlet";

    if (!outletMap.has(outletId)) {
      outletMap.set(outletId, {
        outletId, outletName,
        stockIn: 0, stockOut: 0, wastage: 0,
        inventoryValue: 0,
        usageMap: {}, wastageMap: {}
      });
    }

    const o     = outletMap.get(outletId);
    const value = Number(r.qty || 0) * Number(r.cost_price || 0);

    if (r.type === "in")      { o.stockIn  += value; }
    if (r.type === "out")     { o.stockOut += value; o.usageMap[r.item]   = (o.usageMap[r.item]   || 0) + value; }
    if (r.type === "wastage") { o.wastage  += value; o.wastageMap[r.item] = (o.wastageMap[r.item] || 0) + value; }
  });

  outletMap.forEach((o, outletId) => {
    o.openingValue = openingMap?.[outletId] ?? null;
    o.closingValue = closingMap?.[outletId] ?? null;
  });

  // SORT: alphabet by outlet name (bukan outletId)
  const sorted = [...outletMap.values()].sort((a, b) => a.outletName.localeCompare(b.outletName));

  sorted.forEach(o => {
    o.outletName = o.outletName.toUpperCase();
    o.topUsage   = Object.entries(o.usageMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    o.topWastage = Object.entries(o.wastageMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const totalOut   = o.stockOut + o.wastage;
    o.wastagePercent = totalOut > 0 ? (o.wastage / totalOut * 100) : 0;

    delete o.usageMap;
    delete o.wastageMap;
  });

  return sorted;
}

module.exports = { getSummaryReport };