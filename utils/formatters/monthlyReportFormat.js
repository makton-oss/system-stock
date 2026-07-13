const { toProperCase, formatAmount } = require("../helpers");

// ======================
// HELPERS
// ======================
function line(label, value) {
  return `${label}\n${value}\n\n`;
}

function divider() {
  return `━━━━━━━━━━\n\n`;
}

// ======================
// SECTION: EXECUTIVE SUMMARY
// ======================
function buildExecutiveSummary({ data, lowStock, deadStockCount, health, label }) {

  const totalClosing  = data.reduce((a, o) => a + (o.closingValue  || 0), 0);
  const totalOpening  = data.reduce((a, o) => a + (o.openingValue  || 0), 0);
  const totalStockIn  = data.reduce((a, o) => a + (o.stockIn       || 0), 0);
  const totalStockOut = data.reduce((a, o) => a + (o.stockOut      || 0), 0);
  const totalWastage  = data.reduce((a, o) => a + (o.wastage       || 0), 0);
  const netChange     = totalClosing - totalOpening;
  const netSign       = netChange >= 0 ? "+" : "";

  let text = `📊 MONTHLY REPORT\n${label}\n\n`;
  text += divider();
  text += `📋 EXECUTIVE SUMMARY\n\n`;
  text += line("Inventory Value (Closing)", `RM ${formatAmount(totalClosing)}`);

  if (totalOpening > 0) {
    text += line("Opening Inventory", `RM ${formatAmount(totalOpening)}`);
    text += line("Net Change", `${netSign}RM ${formatAmount(Math.abs(netChange))}`);
  }

  text += line("Stock In",  `RM ${formatAmount(totalStockIn)}`);
  text += line("Stock Out", `RM ${formatAmount(totalStockOut)}`);
  text += line("Wastage",   `RM ${formatAmount(totalWastage)}`);
  text += line("Low Stock",   `${lowStock.length} item`);
  text += line("Dead Stock",  `${deadStockCount} item`);
  text += line("Business Health", health);

  return text;
}

// ======================
// SECTION: TOP CONSUMPTION
// Gabung top usage semua outlet, sort by value
// ======================
function buildTopConsumption(data) {

  // Merge topUsage across outlets
  const merged = {};
  data.forEach(o => {
    (o.topUsage || []).forEach(([item, val]) => {
      merged[item] = (merged[item] || 0) + val;
    });
  });

  const sorted = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!sorted.length) return "";

  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  let text = divider();
  text += `🔥 TOP CONSUMPTION\n\n`;
  sorted.forEach(([item, val], i) => {
    text += `${medals[i]} ${toProperCase(item)}\n    RM ${formatAmount(val)}\n`;
  });
  text += "\n";

  return text;
}

// ======================
// SECTION: WASTAGE
// ======================
function buildWastageSection(data) {

  const merged = {};
  data.forEach(o => {
    (o.topWastage || []).forEach(([item, val]) => {
      merged[item] = (merged[item] || 0) + val;
    });
  });

  const sorted = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalWastage = data.reduce((a, o) => a + (o.wastage || 0), 0);
  if (totalWastage === 0) return "";

  let text = divider();
  text += `⚠️ WASTAGE ANALYSIS\n\n`;
  text += line("Total Wastage", `RM ${formatAmount(totalWastage)}`);

  if (sorted.length) {
    text += `Top Items\n`;
    sorted.forEach(([item, val], i) => {
      text += `${i + 1}. ${toProperCase(item)} — RM ${formatAmount(val)}\n`;
    });
    text += "\n";
  }

  return text;
}

// ======================
// SECTION: LOW STOCK
// ======================
function buildLowStockSection(lowStock) {

  let text = divider();
  text += `⚠️ LOW STOCK\n\n`;

  if (!lowStock.length) {
    text += `✅ Tiada low stock item\n\n`;
    return text;
  }

  // Group by outlet
  const byOutlet = {};
  lowStock.forEach(s => {
    const name = s.outlets?.name || "Outlet";
    if (!byOutlet[name]) byOutlet[name] = [];
    byOutlet[name].push(s);
  });

  Object.entries(byOutlet).forEach(([outlet, items]) => {
    if (Object.keys(byOutlet).length > 1) {
      text += `🏪 ${toProperCase(outlet)}\n`;
    }
    items.forEach(s => {
      const diff = Number(s.min_qty) - Number(s.qty);
      text += `• ${toProperCase(s.item_name)}  Baki: ${s.qty}  Min: ${s.min_qty}  (−${diff})\n`;
    });
    text += "\n";
  });

  return text;
}

// ======================
// SECTION: OUTLET BREAKDOWN (>1 outlet only)
// ======================
function buildOutletBreakdown(data) {

  if (data.length <= 1) return "";

  let text = divider();
  text += `🏪 OUTLET BREAKDOWN\n\n`;

  // Sort by stockOut desc (highest usage = best performer)
  const sorted = [...data].sort((a, b) => b.stockOut - a.stockOut);

  sorted.forEach((o, i) => {
    const medals = ["🥇", "🥈", "🥉"];
    const prefix = medals[i] || `${i + 1}.`;
    text += `${prefix} ${o.outletName}\n`;
    text += `   Inventory : RM ${formatAmount(o.closingValue || 0)}\n`;
    text += `   Usage     : RM ${formatAmount(o.stockOut || 0)}\n`;
    text += `   Wastage   : RM ${formatAmount(o.wastage || 0)} (${o.wastagePercent.toFixed(1)}%)\n\n`;
  });

  return text;
}

// ======================
// SECTION: MONTHLY COMPARISON
// ======================
function buildComparisonSection(data) {

  const hasComparison = data.some(o =>
    o.prevStockIn !== undefined || o.prevStockOut !== undefined
  );

  if (!hasComparison) return "";

  const curr = {
    stockIn:  data.reduce((a, o) => a + (o.stockIn  || 0), 0),
    stockOut: data.reduce((a, o) => a + (o.stockOut || 0), 0),
    wastage:  data.reduce((a, o) => a + (o.wastage  || 0), 0)
  };

  const prev = {
    stockIn:  data.reduce((a, o) => a + (o.prevStockIn  || 0), 0),
    stockOut: data.reduce((a, o) => a + (o.prevStockOut || 0), 0),
    wastage:  data.reduce((a, o) => a + (o.prevWastage  || 0), 0)
  };

  function trend(c, p) {
    if (!p) return "";
    const pct = ((c - p) / p * 100);
    const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "▬";
    return ` ${arrow} ${Math.abs(pct).toFixed(1)}%`;
  }

  let text = divider();
  text += `📈 VS BULAN LEPAS\n\n`;
  text += `Stock In  : RM ${formatAmount(curr.stockIn)}${trend(curr.stockIn, prev.stockIn)}\n`;
  text += `Stock Out : RM ${formatAmount(curr.stockOut)}${trend(curr.stockOut, prev.stockOut)}\n`;
  text += `Wastage   : RM ${formatAmount(curr.wastage)}${trend(curr.wastage, prev.wastage)}\n\n`;

  return text;
}

// ======================
// SECTION: OWNER INSIGHTS
// ======================
function buildInsightsSection(insights) {

  if (!insights?.length) return "";

  let text = divider();
  text += `💡 OWNER INSIGHTS\n\n`;
  insights.forEach(i => { text += `${i}\n`; });
  text += "\n";

  return text;
}

// ======================
// MAIN FORMATTER
// ======================
function formatMonthlyOwnerReport(result) {

  const { data, label, lowStock, deadStockCount, health, insights } = result;

  if (!data?.length) {
    return `📊 MONTHLY REPORT\n${label}\n\n📭 TIADA DATA UNTUK TEMPOH INI`;
  }

  let text = "";

  text += buildExecutiveSummary({ data, lowStock, deadStockCount, health, label });
  text += buildComparisonSection(data);
  text += buildTopConsumption(data);
  text += buildWastageSection(data);
  text += buildLowStockSection(lowStock);
  text += buildOutletBreakdown(data);
  text += buildInsightsSection(insights);

  text += divider();
  text += `Reply EXPORT FULL untuk laporan Excel penuh`;

  return text.trim();
}

module.exports = { formatMonthlyOwnerReport };