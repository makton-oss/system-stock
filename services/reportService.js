const supabase = require("./db");

// helper: group by outlet
function groupByOutlet(rows) {
  const map = {};
  rows.forEach(r => {
    const outlet = r.outlets?.name || "Outlet";
    if (!map[outlet]) map[outlet] = [];
    map[outlet].push(r);
  });
  return map;
}

async function getMainReport({ start, end, outletId, isAdmin }) {

  let query = supabase
    .from("stock_movements")
    .select(`
      qty,
      type,
      outlet_id,
	  cost_price,
	  item,
      stock_items(name, category),
      outlets(name)
    `)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;
  if (error) return { error };

  const outletMap = {};

  data.forEach(r => {

    const outlet = r.outlets?.name || "Outlet";
    const cost = r.qty * r.cost_price;

    if (!outletMap[outlet]) {
      outletMap[outlet] = {
        totalCost: 0,
        flowIn: 0,
        flowOut: 0,
        itemMap: {},
        categoryMap: {}
      };
    }

    const o = outletMap[outlet];

    if (r.type === "out") {
      o.totalCost += cost;
      o.flowOut += cost;
    } else {
      o.flowIn += cost;
    }

    const name = r.item;
    o.itemMap[name] = (o.itemMap[name] || 0) + cost;

    const cat = r.stock_items?.category || "lain";
    o.categoryMap[cat] = (o.categoryMap[cat] || 0) + cost;
  });

  return outletMap;
}

// ======================
// INVENTORY
// ======================
async function getInventoryReport({ outletId }) {

  let q = supabase
    .from("stock")
    .select(`
      qty,
      outlet_id,
	  cost_price,
      stock_items(name),
      outlets(name)
    `);

  if (outletId) q = q.eq("outlet_id", outletId);

  const { data, error } = await q;
  if (error) return { error };

  return groupByOutlet(data);
}

// ======================
// DETAIL IN OUT
// ======================
async function getDetailReport({ start, end, outletId }) {

  let q = supabase
    .from("stock_movements")
    .select(`
      qty,
      type,
      item_id,
      outlet_id,
	  item,
      stock_items(name),
      outlets(name)
    `)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletId) q = q.eq("outlet_id", outletId);

  const { data, error } = await q;
  if (error) return { error };

  const grouped = groupByOutlet(data);

  const result = {};

  Object.entries(grouped).forEach(([outlet, rows]) => {

    const map = {};

    rows.forEach(r => {

	  const id =
		r.item_id || r.item || "unknown";

	  const itemName =
		r.stock_items?.name ||
		r.item ||
		"Unknown";

	  if (!map[id]) {
		map[id] = {
		  name: itemName,
		  in: 0,
		  out: 0
		};
	  }

	  if (r.type === "in") {
		map[id].in += Number(r.qty || 0);
	  } else {
		map[id].out += Number(r.qty || 0);
	  }
	});

    result[outlet] = Object.values(map).map(i => ({
      ...i,
      bal: i.in - i.out
    }));
  });
console.log("DETAIL REPORT:", result);
  return result;
}

// ======================
// DEAD STOCK
// ======================
async function getDeadReport({ start, end, outletId }) {

  let stockQ = supabase
    .from("stock")
    .select(`
      item_id,
	  item,
      outlet_id,
      stock_items(name),
      outlets(name)
    `);

  if (outletId) stockQ = stockQ.eq("outlet_id", outletId);

  const { data: stock } = await stockQ;

  let moveQ = supabase
    .from("stock_movements")
    .select("item_id, outlet_id, created_at")
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletId) moveQ = moveQ.eq("outlet_id", outletId);

  const { data: move } = await moveQ;

  const used = new Set(move.map(m => `${m.item_id}-${m.outlet_id}`));

  const grouped = groupByOutlet(stock);

  const result = {};

  Object.entries(grouped).forEach(([outlet, rows]) => {

    result[outlet] = rows
      .filter(r => !used.has(`${r.item_id}-${r.outlet_id}`))
      .map(r => ({
        name: r.stock_items?.name || r.item,
        last: "-"
      }));
  });

  return result;
}

// ======================
// FLOW
// ======================
async function getFlowReport({ start, end, outletId }) {

  let q = supabase
    .from("stock_movements")
    .select(`
      qty,
      type,
      item_id,
	  item,
      outlet_id,
	  cost_price,
      stock_items(name),
      outlets(name)
    `)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletId) q = q.eq("outlet_id", outletId);

  const { data, error } = await q;
  if (error) return { error };

  const grouped = groupByOutlet(data);

  const result = {};

  Object.entries(grouped).forEach(([outlet, rows]) => {

    let inVal = 0;
    let outVal = 0;

    const inMap = {};
    const outMap = {};

    rows.forEach(r => {

      const val = r.qty * r.cost_price;

      if (r.type === "in") {
        inVal += val;
        inMap[r.item] =
          (inMap[r.item] || 0) + val;
      } else {
        outVal += val;
        outMap[r.item] =
          (outMap[r.item] || 0) + val;
      }
    });

    result[outlet] = {
      inVal,
      outVal,
      net: inVal - outVal,
      topIn: Object.entries(inMap)
        .sort((a,b)=>b[1]-a[1]).slice(0,5),
      topOut: Object.entries(outMap)
        .sort((a,b)=>b[1]-a[1]).slice(0,5)
    };
  });

  return result;
}

module.exports = {
  getMainReport,
  getInventoryReport,
  getDetailReport,
  getDeadReport,
  getFlowReport
};