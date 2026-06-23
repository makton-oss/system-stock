const { DateTime } = require("luxon");
const { toProperCase, formatLogDateTime } = require("../helpers");

// ======================
// PRIVATE HELPERS
// ======================
function _groupByOutlet(rows) {
  const map = new Map();
  rows.forEach(r => {
    const outlet = r.outlets?.name || "-";
    if (!map.has(outlet)) map.set(outlet, []);
    map.get(outlet).push(r);
  });
  return map;
}

function _itemBlock(r) {
  const name = toProperCase(r.items?.name || r.item || "-");
  const cost = Number(r.cost_price || 0);
  return `${name}\nUOM: ${r.uom || "-"}\nCost: RM${cost.toFixed(2)}\nMin Qty: ${r.min_qty ?? "-"}\n\n`;
}

function _pendingBlock(r) {
  const date = DateTime
    .fromISO(r.created_at)
    .setZone("Asia/Kuala_Lumpur")
    .toFormat("d/M | HH:mm");
  return `ID ${r.id} | ${date}\n${toProperCase(r.type)} ${toProperCase(r.item)} x ${r.qty}\nBY: ${toProperCase(r.users?.nickname || "-")} (${r.users?.chat_id || "-"})\n\n`;
}

// ======================
// ITEM NAME LIST (staff)
// ======================
function formatItemNameList(rows) {
  if (!rows?.length) return "📦 ITEM KOSONG";
  let text = "📦 ITEM LIST (A-Z)\n\n";
  rows.forEach((r, i) => {
    text += `${i + 1}. ${toProperCase(r.item)} - ${r.uom}\n`;
  });
  return text;
}

// ======================
// ITEM CONFIG — single outlet
// ======================
function formatItemList(rows) {
  if (!rows?.length) return "📦 ITEM KOSONG";
  let text = "📦 ITEM CONFIG\n\n";
  rows.forEach(r => { text += _itemBlock(r); });
  return text;
}

// ======================
// ITEM CONFIG — multi outlet
// ======================
function formatItemListAdmin(rows) {
  if (!rows?.length) return "📦 ITEM KOSONG";
  let text = "📦 ITEM CONFIG\n\n";
  _groupByOutlet(rows).forEach((items, outlet) => {
    text += `${toProperCase(outlet)}\n\n`;
    items.forEach(r => { text += _itemBlock(r); });
    text += "\n";
  });
  return text;
}

// ======================
// STOCK — single outlet
// ======================
function formatStock(rows) {
  if (!rows?.length) return "📦 STOCK KOSONG";
  const outlet = rows[0]?.outlets?.name || "-";
  let text = `📦 STOCK\n🏪 ${toProperCase(outlet)}\n${formatLogDateTime()}\n`;
  rows.forEach((r, i) => {
    text += `${i + 1}. ${toProperCase(r.items?.name || r.item || "-")} x ${r.qty} (${r.uom || "UOM"})\n`;
  });
  return text;
}

// ======================
// STOCK — multi outlet
// ======================
function formatStockAdmin(rows) {
  if (!rows?.length) return "📦 STOCK KOSONG";
  let text = "📦 STOCK\n";
  _groupByOutlet(rows).forEach((items, outlet) => {
    text += `🏪 ${toProperCase(outlet)}\n${formatLogDateTime()}\n`;
    items.forEach((r, i) => {
      text += `${i + 1}. ${toProperCase(r.items?.name || r.item || "-")} x ${r.qty} (${r.uom || "UOM"})\n`;
    });
    text += "\n\n";
  });
  return text;
}

// ======================
// STOCK — single outlet, grouped by category
// ======================
function formatStockByCategory(rows) {
  if (!rows?.length) return "📦 STOCK KOSONG";

  const outlet = rows[0]?.outlets?.name || "-";
  let text = `📦 STOCK\n🏪 ${toProperCase(outlet)}\n${formatLogDateTime()}\n\n`;

  // Group by category
  const categoryMap = new Map();
  rows.forEach(r => {
    const cat = toProperCase(r.items?.category || r.category || "Lain-lain");
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat).push(r);
  });

  // Sort categories alphabetically
  const sortedCategories = [...categoryMap.keys()].sort();

  let counter = 1;
  sortedCategories.forEach(cat => {
    text += `${cat}\n`;
    categoryMap.get(cat).forEach(r => {
      const name = toProperCase(r.items?.name || r.item || "-");
      const low = r.qty <= r.min_qty && r.min_qty > 0 ? ' ⚠️' : '';
      text += `${counter}. ${name} x ${r.qty} (${r.uom || "UOM"})${low}\n`;
      counter++;
    });
    text += "\n";
  });

  return text.trim();
}

// ======================
// STOCK — multi outlet, grouped by category
// ======================
function formatStockAdminByCategory(rows) {
  if (!rows?.length) return "📦 STOCK KOSONG";

  let text = "📦 STOCK\n";

  const outletMap = _groupByOutlet(rows);

  outletMap.forEach((items, outlet) => {
    text += `🏪 ${toProperCase(outlet)}\n${formatLogDateTime()}\n\n`;

    const categoryMap = new Map();
    items.forEach(r => {
      const cat = toProperCase(r.items?.category || r.category || "Lain-lain");
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat).push(r);
    });

    const sortedCategories = [...categoryMap.keys()].sort();

    let counter = 1;
    sortedCategories.forEach(cat => {
      text += `${cat}\n`;
      categoryMap.get(cat).forEach(r => {
        const name = toProperCase(r.items?.name || r.item || "-");
        const low = r.qty <= r.min_qty && r.min_qty > 0 ? ' ⚠️' : '';
        text += `${counter}. ${name} x ${r.qty} (${r.uom || "UOM"})${low}\n`;
        counter++;
      });
      text += "\n";
    });

    text += "\n";
  });

  return text.trim();
}

// ======================
// PENDING — single outlet
// ======================
function formatPending(rows) {
  if (!rows?.length) return "📭 TIADA REQUEST";
  const outlet = rows[0]?.outlets?.name || "-";
  let text = `📋 PENDING LIST\n${toProperCase(outlet)}\n\n`;
  rows.forEach(r => { text += _pendingBlock(r); });
  return text;
}

// ======================
// PENDING — multi outlet
// ======================
function formatPendingAdmin(rows) {
  if (!rows?.length) return "📭 TIADA REQUEST";
  let text = "📋 PENDING LIST\n\n";
  _groupByOutlet(rows).forEach((list, outlet) => {
    text += `${toProperCase(outlet)}\n\n`;
    list.forEach(r => { text += _pendingBlock(r); });
  });
  return text;
}

// ======================
// LOW STOCK ALERT
// ======================
function formatLowStockAlert(item, qty, minQty) {
  return `⚠️ LOW STOCK ALERT\n\nITEM: ${toProperCase(item)}\nBALANCE: ${qty}\nMINIMUM: ${minQty}`;
}

// ======================
// LOW STOCK ALERT — CONSOLIDATED
// ======================
function formatLowStockAlertGroup(items) {
  if (!items?.length) return null;

  let text = "⚠️ LOW STOCK ALERT\n\n";

  if (items.length === 1) {
    text += `${toProperCase(items[0].item)} (Bal: ${items[0].qty})`;
  } else {
    text += items
      .map((i, idx) => `${idx + 1}. ${toProperCase(i.item)} (Bal: ${i.qty})`)
      .join("\n");
  }

  return text;
}

module.exports = {
  formatItemNameList,
  formatItemList,
  formatItemListAdmin,
  formatStock,
  formatStockAdmin,
  formatStockByCategory,
  formatStockAdminByCategory,
  formatPending,
  formatPendingAdmin,
  formatLowStockAlert,
  formatLowStockAlertGroup
};