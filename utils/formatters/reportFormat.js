const { toProperCase, formatCurrency, formatAmount } = require("../helpers");

// ======================
// SUMMARY REPORT
// ======================
function formatSummaryReport(data, monthLabel) {
  let text = `📊 MONTHLY REPORT\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${o.outletName.toUpperCase()}\n━━━━━━━━━━\n\n`;

    if (o.openingValue !== null) {
      text += `📂 OPENING STOCK\nRM ${formatAmount(o.openingValue)}\n\n`;
    }

    text += `📥 STOCK IN\nRM ${formatAmount(o.stockIn)}\n\n`;
    text += `💸 STOCK USED\nRM ${formatAmount(o.stockOut)}\n\n`;
    text += `⚠️ WASTAGE\nRM ${formatAmount(o.wastage)}\n\n`;

    if (o.closingValue !== null) {
      text += `📁 CLOSING STOCK\nRM ${formatAmount(o.closingValue)}\n\n`;
    } else {
      text += `📁 CLOSING STOCK\n(snapshot tiada)\n\n`;
    }

    text += `📉 WASTAGE %\n${o.wastagePercent.toFixed(1)}%\n\n`;

    text += `🔥 TOP USAGE\n`;
    o.topUsage.forEach(([item, val]) => {
      text += `${toProperCase(item)} RM ${formatAmount(val)}\n`;
    });

    text += `\n🧨 TOP WASTAGE\n`;
    o.topWastage.forEach(([item, val]) => {
      text += `${toProperCase(item)} RM ${formatAmount(val)}\n`;
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
    text += `🏪 ${outlet.toUpperCase()}\n\n`;
    text += `💰 Inventory Value:\nRM ${formatAmount(r.totalValue || 0)}\n\n`;
    text += `📦 Total Unit:\n${r.totalItems}\n\n`;
    text += `📋 Top Holding Stock\n`;

    if (!r.items.length) {
      text += "-\n\n";
      return;
    }

    r.items.forEach(i => {
      text += `• ${toProperCase(i.item)}\n  ${i.qty} unit\n  RM ${formatAmount(i.value || 0)}\n`;
    });

    text += "\n";
  });

  return text.trim();
}

// ======================
// FLOW REPORT
// ======================
function formatFlowReport(data, month) {
  let text = `💸 FLOW REPORT\n${month}\n\n`;

  Object.entries(data).forEach(([outlet, r]) => {
    text += `🏪 ${outlet.toUpperCase()}\n\n`;
    text += `IN      : RM ${formatAmount(r.inVal)}\n`;
    text += `OUT     : RM ${formatAmount(r.outVal)}\n`;
    text += `WASTAGE : RM ${formatAmount(r.wastageVal)}\n`;
    text += `NET     : RM ${formatAmount(r.net)}\n\n`;

    text += "🔝 Top 5 IN\n";
    r.topIn.forEach((t, i) => {
      text += `${i + 1}. ${toProperCase(t[0])} RM ${formatAmount(t[1])}\n`;
    });

    text += "\n🔝 Top 5 OUT\n";
    r.topOut.forEach((t, i) => {
      text += `${i + 1}. ${toProperCase(t[0])} RM ${formatAmount(t[1])}\n`;
    });

    if (r.topWastage?.length) {
      text += "\n🔝 Top 5 WASTAGE\n";
      r.topWastage.forEach((t, i) => {
        text += `${i + 1}. ${toProperCase(t[0])} RM ${formatAmount(t[1])}\n`;
      });
    }

    text += "\n━━━━━━━━━━\n\n";
  });

  return text;
}

// ======================
// DETAIL REPORT
// ======================
function formatDetailReport(data, month) {
  let text = `📊 DETAIL REPORT\n${month}\n\n`;

  Object.entries(data).forEach(([outlet, rows]) => {
    text += `🏪 ${outlet.toUpperCase()}\n\n`;
    rows.forEach(r => {
      const wastageStr = r.wastage > 0 ? ` WS:${r.wastage}` : "";
      text += `${toProperCase(r.name)}\nIN:${r.in} OUT:${r.out}${wastageStr} BAL:${r.bal}\n\n`;
    });
  });

  return text;
}

// ======================
// DEAD STOCK REPORT
// ======================
function formatDeadReport(data, month) {
  let text = `💀 DEAD STOCK\n${month}\n\n`;

  Object.entries(data).forEach(([outlet, rows]) => {
    text += `🏪 ${outlet.toUpperCase()}\n`;
    if (!rows.length) {
      text += "✅ Tiada dead stock\n\n";
      return;
    }
    rows.forEach((r, i) => {
      text += `${i + 1}. ${toProperCase(r.name)}\n`;
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
    text += `🏪 ${o.outletName.toUpperCase()}\n\n`;
    o.items.forEach(([item, val], i) => {
      text += `${i + 1}. ${toProperCase(item)}\nRM ${formatAmount(val)}\n\n`;
    });
    text += `TOTAL:\nRM ${formatAmount(o.total)}\n\n━━━━━━━━━━\n\n`;
  });

  return text;
}

// ======================
// WASTAGE REPORT
// ======================
function formatWastageReport(data, monthLabel) {
  let text = `⚠️ WASTAGE REPORT\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${o.outletName.toUpperCase()}\n\nTOTAL LOSS:\nRM ${formatAmount(o.total)}\n\n`;
    o.items.forEach(([item, val], i) => {
      text += `${i + 1}. ${toProperCase(item)}\nRM ${formatAmount(val)}\n\n`;
    });
    text += `━━━━━━━━━━\n\n`;
  });

  return text;
}

// ======================
// MAIN REPORT (legacy)
// ======================
function formatMainReport(data, monthLabel) {
  let text = `📊 STOCK REPORT\n${monthLabel}\n\n`;

  Object.entries(data).forEach(([outlet, o]) => {
    text += `🏪 ${outlet.toUpperCase()}\n\n`;
    text += `💰 TOTAL USAGE COST RM ${formatAmount(o.totalCost)}\n\n`;
    text += "📦 CATEGORY COST\n";
    Object.entries(o.categoryMap).forEach(([c, v]) => {
      text += `${c}: RM ${formatAmount(v)}\n`;
    });
    text += `\n💸 FLOW (VALUE)\n`;
    text += `IN   : RM ${formatAmount(o.flowIn)}\n`;
    text += `OUT  : RM ${formatAmount(o.flowOut)}\n`;
    text += `NET  : RM ${formatAmount(o.flowIn - o.flowOut)}\n\n`;
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