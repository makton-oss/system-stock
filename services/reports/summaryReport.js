const supabase = require("../db");

async function getSummaryReport({
  start,
  end,
  outletIds
}) {

  let movementQ = supabase
    .from("stock_movements")
    .select(`
      qty,
      type,
      cost_price,
      outlet_id,
      item,
      outlets(name)
    `)
    .gte("created_at", start)
    .lte("created_at", end);

  if (outletIds) {
    movementQ = movementQ.in(
      "outlet_id",
      outletIds
    );
  }

  const {
    data: movements,
    error
  } = await movementQ;

  if (error) {
    return { error };
  }

  // ======================
  // INVENTORY VALUE
  // ======================

  let stockQ = supabase
    .from("stock")
    .select(`
      qty,
      cost_price,
      outlet_id,
      outlets(name)
    `);

  if (outletIds) {
    stockQ = stockQ.in(
      "outlet_id",
      outletIds
    );
  }

  const {
    data: stocks
  } = await stockQ;

  // ======================
  // OUTLET MAP
  // ======================

  const outletMap = new Map();

  // ======================
  // MOVEMENTS
  // ======================

  movements.forEach(r => {

    const outletId =
      r.outlet_id || 9999;

    const outletName =
      r.outlets?.name || "Outlet";

    if (!outletMap.has(outletId)) {

      outletMap.set(outletId, {
        outletId,
        outletName,
        stockIn: 0,
        stockOut: 0,
        wastage: 0,
        inventoryValue: 0,
        usageMap: {},
        wastageMap: {}
      });
    }

    const o =
      outletMap.get(outletId);

    const value =
      Number(r.qty || 0) *
      Number(r.cost_price || 0);

    // ======================
    // STOCK IN
    // ======================

    if (r.type === "in") {
      o.stockIn += value;
    }

    // ======================
    // STOCK OUT (USAGE)
    // ======================

    if (r.type === "out") {

      o.stockOut += value;

      o.usageMap[r.item] =
        (o.usageMap[r.item] || 0) +
        value;
    }

    // ======================
    // WASTAGE
    // ======================

    if (r.type === "wastage") {

      o.wastage += value;

      o.wastageMap[r.item] =
        (o.wastageMap[r.item] || 0) +
        value;
    }
  });

  // ======================
  // INVENTORY VALUE
  // ======================

  stocks.forEach(s => {

    const outletId =
      s.outlet_id || 9999;

    const outletName =
      s.outlets?.name || "Outlet";

    if (!outletMap.has(outletId)) {

      outletMap.set(outletId, {
        outletId,
        outletName,
        stockIn: 0,
        stockOut: 0,
        wastage: 0,
        inventoryValue: 0,
        usageMap: {},
        wastageMap: {}
      });
    }

    outletMap
      .get(outletId)
      .inventoryValue +=
        Number(s.qty || 0) *
        Number(s.cost_price || 0);
  });

  // ======================
  // SORT OUTLET
  // ======================

  const sorted =
    [...outletMap.values()]
      .sort((a, b) =>
        a.outletId - b.outletId
      );

  // ======================
  // FINAL FORMAT
  // ======================

  sorted.forEach(o => {

    o.topUsage =
      Object.entries(o.usageMap)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5);

    o.topWastage =
      Object.entries(o.wastageMap)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5);

    o.wastagePercent =
      o.stockOut > 0
        ? (
            o.wastage /
            o.stockOut *
            100
          )
        : 0;

    delete o.usageMap;
    delete o.wastageMap;
  });

  return sorted;
}

module.exports = {
  getSummaryReport
};