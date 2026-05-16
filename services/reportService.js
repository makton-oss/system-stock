const supabase = require("./db");

// ======================
// MAIN REPORT
// ======================
async function getMainReport({ start, end, outletId }) {

  let query = supabase
    .from("stock_movements")
    .select(`
      qty,
      type,
      item_id,
      stock_items(name, cost_price, category)
    `)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;
  if (error) return { error };

  let totalCost = 0;
  let flowIn = 0;
  let flowOut = 0;

  const itemMap = {};
  const categoryMap = {};

  data.forEach(r => {

    const cost = r.qty * r.stock_items.cost_price;

    if (r.type === "out") {
      totalCost += cost;
      flowOut += cost;
    } else {
      flowIn += cost;
    }

    const name = r.stock_items.name;
    itemMap[name] = (itemMap[name] || 0) + cost;

    const cat = r.stock_items.category || "lain";
    categoryMap[cat] = (categoryMap[cat] || 0) + cost;
  });

  return {
    totalCost,
    flowIn,
    flowOut,
    net: flowIn - flowOut,
    itemMap,
    categoryMap
  };
}

// ======================
// INVENTORY
// ======================
async function getInventoryReport({ outletId }) {

  let query = supabase
    .from("stock")
    .select(`
      qty,
      stock_items(name, cost_price)
    `);

  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;
  if (error) return { error };

  let total = 0;

  data.forEach(r => {
    total += r.qty * r.stock_items.cost_price;
  });

  return { data, total };
}

// ======================
// FLOW
// ======================
async function getFlowReport({ start, end, outletId }) {

  let query = supabase
    .from("stock_movements")
    .select("qty, type, stock_items(cost_price)")
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;
  if (error) return { error };

  let inVal = 0;
  let outVal = 0;

  data.forEach(r => {
    const val = r.qty * r.stock_items.cost_price;
    if (r.type === "in") inVal += val;
    else outVal += val;
  });

  return {
    inVal,
    outVal,
    net: inVal - outVal
  };
}

// ======================
// DEAD STOCK
// ======================
async function getDeadStock({ outletId }) {

  let stockQuery = supabase
    .from("stock")
    .select(`
      qty,
      item_id,
      stock_items(name)
    `);

  if (outletId) stockQuery = stockQuery.eq("outlet_id", outletId);

  const { data: stock } = await stockQuery;

  let moveQuery = supabase
    .from("stock_movements")
    .select("item_id")
    .eq("type", "out");

  if (outletId) moveQuery = moveQuery.eq("outlet_id", outletId);

  const { data: movement } = await moveQuery;

  const usedSet = new Set(movement.map(m => m.item_id));

  return stock.filter(r => !usedSet.has(r.item_id));
}

// ======================
// DETAIL
// ======================
async function getDetailReport({ start, end, outletId }) {

  let query = supabase
    .from("stock_movements")
    .select(`
      qty,
      type,
      item_id,
      stock_items(name, cost_price)
    `)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;
  if (error) return { error };

  const map = {};

  data.forEach(r => {

    if (!map[r.item_id]) {
      map[r.item_id] = {
        name: r.stock_items.name,
        in: 0,
        out: 0,
        cost: 0
      };
    }

    if (r.type === "in") map[r.item_id].in += r.qty;
    else map[r.item_id].out += r.qty;

    map[r.item_id].cost += r.qty * r.stock_items.cost_price;
  });

  return Object.values(map);
}

module.exports = {
  getMainReport,
  getInventoryReport,
  getFlowReport,
  getDeadStock,
  getDetailReport
};