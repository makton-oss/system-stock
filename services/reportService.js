const supabase = require("./db");
const { applyTenant } = require("../utils/applyTenant");
const { DateTime } = require("luxon");

function groupByOutlet(rows) {
  const map = {};
  rows.forEach(r => {
    const outletKey = r.outlets?.name || "Outlet";
    if (!map[outletKey]) map[outletKey] = [];
    map[outletKey].push(r);
  });
  return map;
}

function sortByOutletNameAsc(grouped) {
  const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const result = {};
  sortedKeys.forEach(k => { result[k.toUpperCase()] = grouped[k]; });
  return result;
}

async function getInventoryReport({ outletIds, snapshotDate, tenantId }) {

  let q = supabase
    .from("snapshots")
    .select(`qty, inventory_value, outlet_id, item_name, outlets(name)`)
    .eq("snapshot_date", snapshotDate);

  if (outletIds) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) return { error };

  const grouped = {};
  data.forEach(r => {
    const outlet = r.outlets?.name || "Outlet";
    if (!grouped[outlet]) grouped[outlet] = { totalValue: 0, totalItems: 0, items: [] };
    grouped[outlet].totalValue += Number(r.inventory_value || 0);
    grouped[outlet].totalItems += Number(r.qty || 0);
    grouped[outlet].items.push({ item: r.item_name, qty: r.qty, value: r.inventory_value });
  });

  Object.values(grouped).forEach(g => {
    g.items = g.items.sort((a, b) => b.value - a.value).slice(0, 10);
  });

  return sortByOutletNameAsc(grouped);
}

async function getDetailReport({ start, end, outletIds, tenantId }) {

  let q = supabase
    .from("movements")
    .select(`item_id, item, qty, type, outlet_id, outlets(name)`)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds?.length) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) return { error };

  const grouped = groupByOutlet(data);
  const result  = {};

  Object.entries(grouped).forEach(([outlet, rows]) => {
    const map = {};
    rows.forEach(r => {
      const key = r.item || "unknown";
      if (!map[key]) map[key] = { name: r.item || "Unknown", in: 0, out: 0, wastage: 0 };
      if (r.type === "in")           map[key].in      += Number(r.qty || 0);
      else if (r.type === "out")     map[key].out     += Number(r.qty || 0);
      else if (r.type === "wastage") map[key].wastage += Number(r.qty || 0);
    });

    // FILTER: hanya item dengan IN > 0 atau OUT > 0
    const items = Object.values(map)
      .map(i => ({ ...i, bal: i.in - i.out - i.wastage }))
      .filter(i => i.in > 0 || i.out > 0);

    result[outlet] = items;
  });

  return sortByOutletNameAsc(result);
}

// ======================
// DEAD STOCK — last movement date per item, kira hari tidak bergerak
// asOfDate = end of period yang dipilih (bukan hari ini, supaya konsisten bila query bulan lepas)
// ======================
async function getDeadReport({ outletIds, tenantId, asOfDate }) {

  let stockQ = supabase
    .from("item_stock")
    .select(`item_id, item, outlet_id, items(name), outlets(name)`)
    .eq("is_active", true);

  if (outletIds?.length) stockQ = stockQ.in("outlet_id", outletIds);
  stockQ = applyTenant(stockQ, tenantId);   // ✅ FIX

  const { data: stock, error: stockError } = await stockQ;

  // ======================
  // CARI LAST MOVEMENT DATE PER ITEM (any time, bukan terhad date range)
  // ======================
  let moveQ = supabase
    .from("movements")
    .select("item_id, outlet_id, created_at")
    .lte("created_at", asOfDate)
    .order("created_at", { ascending: false });

  moveQ = applyTenant(moveQ, tenantId);

  const { data: moves, error: moveError } = await moveQ;
  if (moveError) return { error: moveError };

  const lastMoveMap = {};
  moves.forEach(m => {
    const key = `${m.item_id}-${m.outlet_id}`;
    if (!lastMoveMap[key]) lastMoveMap[key] = m.created_at; // first hit = latest, sebab order desc
  });

  const grouped = groupByOutlet(stock);
  const result  = {};
  const now     = DateTime.fromISO(asOfDate);

  Object.entries(grouped).forEach(([outlet, rows]) => {
    result[outlet] = rows.map(r => {
      const key = `${r.item_id}-${r.outlet_id}`;
      const lastMove = lastMoveMap[key];

      if (!lastMove) {
        return { name: r.items?.name || r.item, daysSince: null, neverMoved: true };
      }

      const daysSince = Math.floor(now.diff(DateTime.fromISO(lastMove), "days").days);
      return { name: r.items?.name || r.item, daysSince, neverMoved: false };
    }).sort((a, b) => (b.daysSince ?? 99999) - (a.daysSince ?? 99999));
  });

  return sortByOutletNameAsc(result);
}

async function getFlowReport({ start, end, outletIds, tenantId }) {

  let q = supabase
    .from("movements")
    .select(`qty, type, item_id, item, outlet_id, cost_price, items(name), outlets(name)`)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds?.length) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);

  const { data, error } = await q;
  if (error) return { error };

  const grouped = groupByOutlet(data);
  const result  = {};

  Object.entries(grouped).forEach(([outlet, rows]) => {
    let inVal = 0, outVal = 0, wastageVal = 0;
    const inMap = {}, outMap = {}, wastageMap = {};

    rows.forEach(r => {
      const val = r.qty * (r.cost_price || 0);
      if (r.type === "in") {
        inVal += val;
        inMap[r.item] = (inMap[r.item] || 0) + val;
      } else if (r.type === "out") {
        outVal += val;
        outMap[r.item] = (outMap[r.item] || 0) + val;
      } else if (r.type === "wastage") {
        wastageVal += val;
        wastageMap[r.item] = (wastageMap[r.item] || 0) + val;
      }
    });

    result[outlet] = {
      inVal, outVal, wastageVal,
      net: inVal - outVal - wastageVal,
      topIn:      Object.entries(inMap).sort((a,b)=>b[1]-a[1]).slice(0,5),
      topOut:     Object.entries(outMap).sort((a,b)=>b[1]-a[1]).slice(0,5),
      topWastage: Object.entries(wastageMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
    };
  });

  return sortByOutletNameAsc(result);
}

module.exports = { getInventoryReport, getDetailReport, getDeadReport, getFlowReport };