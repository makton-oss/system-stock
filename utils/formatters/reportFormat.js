const { toProperCase, formatAmount } = require("../helpers");

// ======================
// EMPTY STATE TEMPLATE
// ======================
function emptyState(emoji, title, monthLabel, reason = "Tiada pergerakan stok untuk tempoh ini.") {
  return `${emoji} ${title}\n${monthLabel}\n\n📭 TIADA DATA\n\n${reason}`;
}

// ======================
// SUMMARY REPORT
// ======================
function formatSummaryReport(data, monthLabel) {

  if (!data?.length) {
    return emptyState("📊", "MONTHLY REPORT", monthLabel);
  }

  let text = `📊 MONTHLY REPORT\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${o.outletName}\n━━━━━━━━━━\n\n`;

    if (o.openingValue !== null) {
      text += `📂 OPENING STOCK\nRM ${formatAmount(o.openingValue)}\n\n`;
    } else {
      text += `📂 OPENING STOCK\n(snapshot tiada)\n\n`;
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
    if (!o.topUsage.length) {
      text += `-\n`;
    } else {
      o.topUsage.forEach(([item, val]) => {
        text += `${toProperCase(item)}\nRM ${formatAmount(val)}\n\n`;
      });
    }

    text += `🧨 TOP WASTAGE\n`;
    if (!o.topWastage.length) {
      text += `-\n`;
    } else {
      o.topWastage.forEach(([item, val]) => {
        text += `${toProperCase(item)}\nRM ${formatAmount(val)}\n\n`;
      });
    }

    text += `━━━━━━━━━━\n\n`;
  });

  return text.trim();
}

// ======================
// INVENTORY REPORT
// ======================
function formatInventoryReport(data, monthLabel) {

  if (!Object.keys(data).length) {
    return emptyState("📦", "INVENTORY REPORT", monthLabel, "Tiada snapshot untuk tarikh ini. Snapshot dijana setiap hari tengah malam.");
  }

  let text = `📦 INVENTORY REPORT\n📅 ${monthLabel}\n\n`;

  Object.entries(data).forEach(([outlet, r]) => {
    text += `🏪 ${outlet}\n\n`;
    text += `💰 Inventory Value\nRM ${formatAmount(r.totalValue || 0)}\n\n`;
    text += `📦 Total Unit\n${r.totalItems}\n\n`;
    text += `📋 Top Holding Stock\n`;

    if (!r.items.length) {
      text += "-\n\n";
      return;
    }

    r.items.forEach(i => {
      text += `${toProperCase(i.item)}\n${i.qty} unit — RM ${formatAmount(i.value || 0)}\n\n`;
    });
  });

  return text.trim();
}

// ======================
// FLOW REPORT
// ======================
function formatFlowReport(data, month) {

  if (!Object.keys(data).length) {
    return emptyState("💸", "FLOW REPORT", month);
  }

  let text = `💸 FLOW REPORT\n${month}\n\n`;

  Object.entries(data).forEach(([outlet, r]) => {
    text += `🏪 ${outlet}\n\n`;
    text += `IN      : RM ${formatAmount(r.inVal)}\n`;
    text += `OUT     : RM ${formatAmount(r.outVal)}\n`;
    text += `WASTAGE : RM ${formatAmount(r.wastageVal)}\n`;
    text += `NET     : RM ${formatAmount(r.net)}\n\n`;

    text += "🔝 Top 5 IN\n";
    if (!r.topIn.length) {
      text += "-\n\n";
    } else {
      r.topIn.forEach((t, i) => {
        text += `${i + 1}. ${toProperCase(t[0])} - RM ${formatAmount(t[1])}\n`;
      });
      text += "\n";
    }

    text += "🔝 Top 5 OUT\n";
    if (!r.topOut.length) {
      text += "-\n\n";
    } else {
      r.topOut.forEach((t, i) => {
        text += `${i + 1}. ${toProperCase(t[0])} - RM ${formatAmount(t[1])}\n`;
      });
      text += "\n";
    }

    if (r.topWastage?.length) {
      text += "🔝 Top 5 WASTAGE\n";
      r.topWastage.forEach((t, i) => {
        text += `${i + 1}. ${toProperCase(t[0])} - RM ${formatAmount(t[1])}\n`;
      });
      text += "\n";
    }

    text += "━━━━━━━━━━\n\n";
  });

  return text.trim();
}

// ======================
// DETAIL REPORT — compact, active items sahaja
// ======================
function formatDetailReport(data, month) {

  const hasData = Object.values(data).some(arr => arr.length);

  if (!hasData) {
    return emptyState("📊", "DETAIL REPORT", month, "Tiada item dengan pergerakan (IN/OUT) untuk tempoh ini.");
  }

  let text = `📊 DETAIL REPORT\n${month}\n\n`;

  Object.entries(data).forEach(([outlet, rows]) => {
    text += `🏪 ${outlet}\n\n`;

    if (!rows.length) {
      text += "Tiada item bergerak\n\n";
      return;
    }

    rows.forEach(r => {
      const wastageStr = r.wastage > 0 ? ` WS:${r.wastage}` : "";
      text += `${toProperCase(r.name)} » IN:${r.in} OUT:${r.out}${wastageStr} BAL:${r.bal}\n`;
    });

    text += "\n";
  });

  return text.trim();
}

// ======================
// DEAD STOCK REPORT — dengan hari tidak bergerak
// ======================
function formatDeadReport(data, month) {

  const hasData = Object.values(data).some(arr => arr.length);

  if (!hasData) {
    return `💀 DEAD STOCK\n${month}\n\n✅ TIADA DEAD STOCK\n\nSemua item ada pergerakan dalam tempoh ini.`;
  }

  const BUCKETS = [
    { label: "⚪ TIDAK PERNAH DIREKOD", test: r => r.neverMoved },
    { label: "🔴 90+ HARI",             test: r => !r.neverMoved && r.daysSince >= 90 },
    { label: "🟠 60-89 HARI",           test: r => !r.neverMoved && r.daysSince >= 60 && r.daysSince < 90 },
    { label: "🟡 30-59 HARI",           test: r => !r.neverMoved && r.daysSince >= 30 && r.daysSince < 60 }
  ];

  let text = `💀 DEAD STOCK\n${month}\n\n`;

  Object.entries(data).forEach(([outlet, rows]) => {
    text += `🏪 ${outlet}\n\n`;

    const dead = rows.filter(r => r.neverMoved || r.daysSince >= 30);

    if (!dead.length) {
      text += "✅ Tiada dead stock\n\n";
      return;
    }

    BUCKETS.forEach(bucket => {
      const items = dead.filter(bucket.test);
      if (!items.length) return;

      text += `${bucket.label} (${items.length})\n`;
      items.forEach((r, i) => {
        const days = r.neverMoved ? "" : ` (${r.daysSince} hari)`;
        text += `${i + 1}. ${toProperCase(r.name)}${days}\n`;
      });
      text += "\n";
    });
  });

  return text.trim();
}

// ======================
// USAGE REPORT
// ======================
function formatUsageReport(data, monthLabel) {

  if (!data?.length) {
    return emptyState("📊", "USAGE REPORT", monthLabel);
  }

  let text = `📊 USAGE REPORT\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${o.outletName}\n\n`;
    o.items.forEach(([item, val], i) => {
      text += `${i + 1}. ${toProperCase(item)}\nRM ${formatAmount(val)}\n\n`;
    });
    text += `TOTAL\nRM ${formatAmount(o.total)}\n\n━━━━━━━━━━\n\n`;
  });

  return text.trim();
}

// ======================
// WASTAGE REPORT
// ======================
function formatWastageReport(data, monthLabel) {

  if (!data?.length) {
    return emptyState("⚠️", "WASTAGE REPORT", monthLabel);
  }

  let text = `⚠️ WASTAGE REPORT\n${monthLabel}\n\n`;

  data.forEach(o => {
    text += `🏪 ${o.outletName}\n\nTOTAL LOSS\nRM ${formatAmount(o.total)}\n\n`;
    o.items.forEach(([item, val], i) => {
      text += `${i + 1}. ${toProperCase(item)}\nRM ${formatAmount(val)}\n\n`;
    });
    text += `━━━━━━━━━━\n\n`;
  });

  return text.trim();
}

// ======================
// MAIN REPORT (legacy)
// ======================
function formatMainReport(data, monthLabel) {

  if (!Object.keys(data).length) {
    return emptyState("📊", "STOCK REPORT", monthLabel);
  }

  let text = `📊 STOCK REPORT\n${monthLabel}\n\n`;

  Object.entries(data).forEach(([outlet, o]) => {
    text += `🏪 ${outlet}\n\n`;
    text += `💰 TOTAL USAGE COST\nRM ${formatAmount(o.totalCost)}\n\n`;
    text += "📦 CATEGORY COST\n";
    Object.entries(o.categoryMap).forEach(([c, v]) => {
      text += `${c}\nRM ${formatAmount(v)}\n\n`;
    });
    text += `💸 FLOW (VALUE)\n`;
    text += `IN   : RM ${formatAmount(o.flowIn)}\n`;
    text += `OUT  : RM ${formatAmount(o.flowOut)}\n`;
    text += `NET  : RM ${formatAmount(o.flowIn - o.flowOut)}\n\n`;
  });

  return text.trim();
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