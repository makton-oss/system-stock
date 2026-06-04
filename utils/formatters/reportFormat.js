const { toProperCase, formatCurrency } = require("../helpers");

// ======================
// SUMMARY REPORT
// ======================
function formatSummaryReport(data, monthLabel) {
  let text = `📊 MONTHLY SUMMARY\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${toProperCase(o.outletName)}\n━━━━━━━━━━\n\n`;
    text += `💸 STOCK USED\n${formatCurrency(o.stockOut)}\n\n`;
    text += `📥 STOCK IN\n${formatCurrency(o.stockIn)}\n\n`;
    text += `⚠️ WASTAGE\n${formatCurrency(o.wastage)}\n\n`;
    text += `📦 INVENTORY VALUE\n${formatCurrency(o.inventoryValue)}\n\n`;
    text += `📉 WASTAGE %\n${o.wastagePercent.toFixed(1)}%\n\n`;

    text += `🔥 TOP USAGE\n`;
    o.topUsage.forEach(([item, val]) => {
      text += `${item} ${formatCurrency(val)}\n`;
    });

    text += `\n🧨 TOP WASTAGE\n`;
    o.topWastage.forEach(([item, val]) => {
      text += `${item} ${formatCurrency(val)}\n`;
    });

    text += `\n━━━━━━━━━━\n\n`;
  });

  return text;
}

// ======================
// INVENTORY REPORT
// ======================
function formatInventoryReport(data, monthLabel) {
  let text = `📦 INVENTORY REPORT\n📅 ${monthLabel}\n\n`;

  Object.entries(data).forEach(([outlet, r]) => {
    text += `🏪 ${toProperCase(outlet)}\n\n`;
    text += `💰 Inventory Value:\nRM${Number(r.totalValue || 0).toFixed(2)}\n\n`;
    text += `📦 Total Unit:\n${r.totalItems}\n\n`;
    text += `📋 Top Holding Stock\n`;

    if (!r.items.length) {
      text += "-\n\n";
      return;
    }

    r.items.forEach(i => {
      text += `• ${toProperCase(i.item)}\n  ${i.qty} unit\n  RM${Number(i.value || 0).toFixed(2)}\n`;
    });

    text += "\n";
  });

  return text.trim();
}

// ======================
// FLOW REPORT
// ======================
function formatFlowReport(data, month) {
  let text = `💸 FLOW (Value) REPORT - ${month}\n`;

  Object.entries(data).forEach(([outlet, r]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    text += `IN      : RM ${Number(r.inVal      || 0).toFixed(2)} (Stock Added)\n`;
    text += `OUT     : RM ${Number(r.outVal     || 0).toFixed(2)} (Stock Used)\n`;
    text += `WASTAGE : RM ${Number(r.wastageVal || 0).toFixed(2)} (Buang)\n`;
    text += `NET     : RM ${Number(r.net        || 0).toFixed(2)} (Value Change)\n\n`;

    text += "Top 5 IN STOCK\n";
    r.topIn.forEach((t, i) => {
      text += `${i + 1}. ${toProperCase(t[0])} RM${Number(t[1] || 0).toFixed(2)}\n`;
    });

    text += "\nTop 5 OUT STOCK\n";
    r.topOut.forEach((t, i) => {
      text += `${i + 1}. ${toProperCase(t[0])} RM${Number(t[1] || 0).toFixed(2)}\n`;
    });

    if (r.topWastage?.length) {
      text += "\nTop 5 WASTAGE\n";
      r.topWastage.forEach((t, i) => {
        text += `${i + 1}. ${toProperCase(t[0])} RM${Number(t[1] || 0).toFixed(2)}\n`;
      });
    }

    text += "\n";
  });

  return text;
}

// ======================
// DETAIL REPORT
// ======================
function formatDetailReport(data, month) {
  let text = `📊 DETAIL INOUT REPORT - ${month}\n`;

  Object.entries(data).forEach(([outlet, rows]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    rows.forEach(r => {
      const wastageStr = r.wastage > 0 ? ` WS:${r.wastage}` : "";
      text += `${toProperCase(r.name)}\nIN: ${r.in} OUT: ${r.out}${wastageStr} BAL:${r.bal}\n\n`;
    });
  });

  return text;
}

// ======================
// DEAD STOCK REPORT
// ======================
function formatDeadReport(data, month) {
  let text = `💀 DEAD STOCK - ${month}\n`;

  Object.entries(data).forEach(([outlet, rows]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    rows.forEach((r, i) => {
      text += `${i + 1}. ${toProperCase(r.name)} (${r.last})\n`;
    });
    text += "\n";
  });

  return text;
}

// ======================
// USAGE REPORT
// ======================
function formatUsageReport(data, monthLabel) {
  let text = `📊 USAGE REPORT\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${toProperCase(o.outletName)}\n\n`;
    o.items.forEach(([item, val], i) => {
      text += `${i + 1}. ${item}\nRM${Number(val).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\n\n`;
    });
    text += `TOTAL:\nRM${Number(o.total).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\n\n━━━━━━━━━━\n\n`;
  });

  return text;
}

// ======================
// WASTAGE REPORT
// ======================
function formatWastageReport(data, monthLabel) {
  let text = `⚠️ WASTAGE REPORT\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${toProperCase(o.outletName)}\n\nTOTAL LOSS:\nRM${Number(o.total).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\n\n`;
    o.items.forEach(([item, val], i) => {
      text += `${i + 1}. ${item}\nRM${Number(val).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\n\n`;
    });
    text += `━━━━━━━━━━\n\n`;
  });

  return text;
}

// ======================
// MAIN REPORT (legacy)
// ======================
function formatMainReport(data, monthLabel) {
  let text = `📊 STOCK REPORT - ${monthLabel}\n`;

  Object.entries(data).forEach(([outlet, o]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    text += `💰 TOTAL USAGE COST RM ${o.totalCost.toFixed(2)}\n\n`;
    text += "\n📦 CATEGORY COST\n";
    Object.entries(o.categoryMap).forEach(([c, v]) => {
      text += `${c}: RM${v.toFixed(2)}\n`;
    });
    text += `\n💸 FLOW (VALUE)\n`;
    text += `IN   : RM ${o.flowIn.toFixed(2)} (Stock Added)\n`;
    text += `OUT  : RM ${o.flowOut.toFixed(2)} (Stock Used)\n`;
    text += `NET  : RM ${(o.flowIn - o.flowOut).toFixed(2)} (Value Change)\n\n`;
  });

  return text;
}

module.exports = {
  formatSummaryReport,
  formatInventoryReport,
  formatFlowReport,
  formatDetailReport,
  formatDeadReport,
  formatUsageReport,
  formatWastageReport,
  formatMainReport
};