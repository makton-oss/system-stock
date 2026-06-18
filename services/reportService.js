const supabase = require("./db");
const { applyTenant } = require("../utils/applyTenant");

function groupByOutlet(rows) {
  const map = {};
  rows.forEach(r => {
    const outletKey = r.outlets?.name || "Outlet";
    if (!map[outletKey]) map[outletKey] = [];
    map[outletKey].push(r);
  });
  return map;
}

async function getInventoryReport({ outletIds, snapshotDate, tenantId }) {

  let q = supabase
    .from("snapshots")        // ✅ fix: stock_snapshots → snapshots
    .select(`qty, inventory_value, outlet_id, item_name, outlets(name)`)
    .eq("snapshot_date", snapshotDate);

  if (outletIds) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);  // snapshots ada tenant_id ✅

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

  return grouped;
}

async function getDetailReport({ start, end, outletIds, tenantId }) {

  let q = supabase
    .from("movements")        // ✅ fix: stock_movements → movements
    .select(`item_id, item, qty, type, outlet_id, outlets(name)`)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds?.length) q = q.in("outlet_id", outletIds);
  q = applyTenant(q, tenantId);  // movements ada tenant_id ✅

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
    result[outlet] = Object.values(map).map(i => ({ ...i, bal: i.in - i.out - i.wastage }));
  });

  return result;
}

async function getDeadReport({ start, end, outletIds, tenantId }) {

  // ⚠️ item_stock tiada tenant_id
  let stockQ = supabase
    .from("item_stock")       // ✅ fix: stock → item_stock
    .select(`item_id, item, outlet_id, items(name), outlets(name)`)  // ✅ fix: stock_items → items
    .eq("is_active", true);

  if (outletIds?.length) stockQ = stockQ.in("outlet_id", outletIds);
  // Tak boleh applyTenant pada item_stock — outletIds dah scope

  const { data: stock } = await stockQ;

  let moveQ = supabase
    .from("movements")        // ✅ fix: stock_movements → movements
    .select("item_id, outlet_id")
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds?.length) moveQ = moveQ.in("outlet_id", outletIds);
  moveQ = applyTenant(moveQ, tenantId);

  const { data: move } = await moveQ;

  const used    = new Set(move.map(m => `${m.item_id}-${m.outlet_id}`));
  const grouped = groupByOutlet(stock);
  const result  = {};

  Object.entries(grouped).forEach(([outlet, rows]) => {
    result[outlet] = rows
      .filter(r => !used.has(`${r.item_id}-${r.outlet_id}`))
      .map(r => ({ name: r.items?.name || r.item }));  // ✅ fix: stock_items → items
  });

  return result;
}

async function getFlowReport({ start, end, outletIds, tenantId }) {

  let q = supabase
    .from("movements")        // ✅ fix: stock_movements → movements
    .select(`qty, type, item_id, item, outlet_id, cost_price, items(name), outlets(name)`)  // ✅ fix
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

  return result;
}

module.exports = { getInventoryReport, getDetailReport, getDeadReport, getFlowReport };