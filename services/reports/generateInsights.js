function generateInsights({ comparison, lowStockCount, tenant }) {
  const insights = [];
  const wastageThreshold = tenant?.wastage_alert_pct ?? 20;
  const concentrationThreshold = tenant?.item_concentration_pct ?? 30;

  comparison.forEach(o => {
    if (o.wastageChange >= wastageThreshold) {
      insights.push(`⚠ Wastage di ${o.outletName} meningkat ${o.wastageChange.toFixed(0)}% berbanding bulan lepas`);
    }

    const totalUsage = o.stockOut || 0;
    const top = o.topUsage?.[0];
    if (top && totalUsage > 0) {
      const pct = (top[1] / totalUsage) * 100;
      if (pct >= concentrationThreshold) {
        insights.push(`⚠ ${top[0]} menyumbang ${pct.toFixed(0)}% penggunaan di ${o.outletName}`);
      }
    }
  });

  if (lowStockCount > 0) {
    insights.push(`⚠ ${lowStockCount} item berada di bawah minimum stock`);
  }

  if (!insights.length) insights.push("✅ Tiada isu ketara bulan ini.");
  return insights;
}

function getBusinessHealth({ avgWastagePercent, lowStockCount }) {
  if (avgWastagePercent > 7 || lowStockCount > 15) return "🔴 Attention";
  if (avgWastagePercent > 3 || lowStockCount > 5)  return "🟡 Monitor";
  return "🟢 Healthy";
}

module.exports = { generateInsights, getBusinessHealth };