const supabase = require("../db");

async function getSummaryReport({ start, end, outletIds }) {

  // ── movements ──────────────────────────────
  let movementQ = supabase
    .from("stock_movements")
    .select(`qty, type, cost_price, outlet_id, item, outlets(name)`)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds) movementQ = movementQ.in("outlet_id", outletIds);

  const { data: movements, error } = await movementQ;
  if (error) return { error };

  // ── opening snapshot (1hb bulan) ───────────
  const startDate = new Date(start);
  const openingDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    1
  ).toISOString().split("T")[0]; // "2026-05-01"

  // ── closing snapshot (last day bulan) ──────
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1); // end is exclusive (first day next month)
  const closingDate = endDate.toISOString().split("T")[0]; // "2026-05-31"

  async function fetchSnapshot(date) {
    let q = supabase
      .from("stock_snapshots")
      .select("outlet_id, inventory_value, outlets(name)")
      .eq("snapshot_date", date);

    if (outletIds) q = q.in("outlet_id", outletIds);

    const { data } = await q;
    if (!data?.length) return null;

    // sum per outlet
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

  // ── build outlet map dari movements ────────
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

  // ── attach snapshot values ─────────────────
  outletMap.forEach((o, outletId) => {
    o.openingValue = openingMap?.[outletId] ?? null;
    o.closingValue = closingMap?.[outletId] ?? null;
  });

  const sorted = [...outletMap.values()].sort((a, b) => a.outletId - b.outletId);

  sorted.forEach(o => {
    o.topUsage   = Object.entries(o.usageMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    o.topWastage = Object.entries(o.wastageMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const totalOut      = o.stockOut + o.wastage;
    o.wastagePercent    = totalOut > 0 ? (o.wastage / totalOut * 100) : 0;

    delete o.usageMap;
    delete o.wastageMap;
  });

  return sorted;
}

module.exports = { getSummaryReport };