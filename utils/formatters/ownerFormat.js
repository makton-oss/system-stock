const { formatAmount } = require("../helpers");

// ======================
// TREND ARROW
// ======================
function trendArrow(pct) {
  if (pct > 0) return "▲";
  if (pct < 0) return "▼";
  return "▬";
}

function trendLine(label, current, previous, pct) {
  const arrow = trendArrow(pct);
  const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return `${label} : RM ${formatAmount(current)}\n  (vs RM ${formatAmount(previous)}  ${arrow} ${pctStr})\n`;
}

// ======================
// WASTAGE BADGE
// ======================
function wastageBadge(pct) {
  if (pct < 3)  return "✅";
  if (pct <= 7) return "⚠️";
  return "🚨";
}

// ======================
// MAIN FORMATTER
// ======================
function formatOwnerReport(data, label) {

  if (!data?.length) {
    return `📊 COMPARE REPORT\n${label}\n\n📭 TIADA DATA UNTUK TEMPOH INI`;
  }

  let text = `📊 COMPARE REPORT\n${label}\n\n`;

  data.forEach(o => {
    text += `🏪 ${o.outletName.toUpperCase()}\n\n`;
    text += trendLine("IN     ", o.stockIn,  o.prevStockIn,  o.inChange);
    text += trendLine("OUT    ", o.stockOut, o.prevStockOut, o.outChange);
    text += trendLine("WASTAGE", o.wastage,  o.prevWastage,  o.wastageChange);
    text += `\n`;
  });

  text += `━━━━━━━━━━\n\n`;
  text += `📈 OUTLET PERFORMANCE\n\n`;

  data.forEach(o => {
    const badge = wastageBadge(o.wastagePercent);
    text += `🏪 ${o.outletName.toUpperCase()}\n`;
    text += `OUT Value : RM ${formatAmount(o.stockOut)}\n`;
    text += `Wastage   : ${o.wastagePercent.toFixed(1)}% ${badge}\n\n`;
  });

  return text.trim();
}

module.exports = { formatOwnerReport };