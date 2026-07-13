const { getOwnerReport } = require("./ownerSummary");
const { getDeadReport } = require("../reportService");
const { getLowStockSnapshot } = require("../../db/stock/getLowStockSnapshot");
const { generateInsights, getBusinessHealth } = require("./generateInsights");
const { DateTime } = require("luxon");
const supabase = require("../db");

// ======================
// DERIVE SNAPSHOT DATE — end of reported period (KL timezone)
// dayrange  → yesterday (snapshot belum dijana untuk hari ni)
// monthly   → last day of reported month
// ======================
function deriveSnapshotDate(mode, monthInput) {

  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");

  if (mode !== "monthly" || !monthInput) {
    return now.minus({ days: 1 }).toFormat("yyyy-MM-dd");
  }

  const months = {
    jan: 1, feb: 2, mar: 3, apr: 4,
    may: 5, jun: 6, jul: 7, aug: 8,
    sep: 9, oct: 10, nov: 11, dec: 12
  };

  const [m, y] = monthInput.toLowerCase().split("-");
  const month  = months[m];
  const year   = 2000 + parseInt(y);

  if (!month || isNaN(year)) return now.minus({ days: 1 }).toFormat("yyyy-MM-dd");

  // Last day of that month in KL zone
  const lastDay = DateTime
    .fromObject({ year, month, day: 1 }, { zone: "Asia/Kuala_Lumpur" })
    .endOf("month");

  // If it's still in the future (current month), fallback to yesterday
  if (lastDay > now) {
    return now.minus({ days: 1 }).toFormat("yyyy-MM-dd");
  }

  return lastDay.toFormat("yyyy-MM-dd");
}

// ======================
// FETCH TENANT THRESHOLDS
// Include new columns — fallback gracefully if migration not run yet
// ======================
async function getTenantThresholds(tenantId) {
  if (!tenantId) return null;

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, plan, max_users, wastage_alert_pct, item_concentration_pct")
      .eq("id", tenantId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// ======================
// MAIN
// ======================
async function getMonthlyOwnerReport({ mode, monthInput, outletIds, tenantId }) {

  // Comparison data (current vs previous month) — reuse getOwnerReport
  const ownerResult = await getOwnerReport({ mode, monthInput, outletIds, tenantId });
  if (ownerResult.error) return { error: ownerResult.error };

  const snapshotDate = deriveSnapshotDate(mode, monthInput);

  // Derive asOfDate for dead stock (same as snapshotDate but ISO format)
  const asOfDate = DateTime
    .fromFormat(snapshotDate, "yyyy-MM-dd", { zone: "Asia/Kuala_Lumpur" })
    .endOf("day")
    .toUTC()
    .toISO();

  // Run low stock + dead stock in parallel
  const [lowStockResult, deadResult] = await Promise.all([
    getLowStockSnapshot({ outletIds, tenantId, snapshotDate }),
    getDeadReport({ outletIds, tenantId, asOfDate })
  ]);

  if (lowStockResult.error) return { error: lowStockResult.error };

  // Dead stock count — flatten all outlets
  const deadStockCount = deadResult && !deadResult.error
    ? Object.values(deadResult).reduce((acc, rows) => {
        return acc + rows.filter(r => r.neverMoved || r.daysSince >= 30).length;
      }, 0)
    : 0;

  const tenant = await getTenantThresholds(tenantId);

  const avgWastagePercent = ownerResult.data.length
    ? ownerResult.data.reduce((a, o) => a + o.wastagePercent, 0) / ownerResult.data.length
    : 0;

  const insights = generateInsights({
    comparison:    ownerResult.data,
    lowStockCount: lowStockResult.items.length,
    deadStockCount,
    tenant
  });

  const health = getBusinessHealth({
    avgWastagePercent,
    lowStockCount:  lowStockResult.items.length,
    deadStockCount
  });

  return {
    data:          ownerResult.data,
    label:         ownerResult.label,
    lowStock:      lowStockResult.items,
    deadStockCount,
    snapshotDate,
    insights,
    health
  };
}

module.exports = { getMonthlyOwnerReport };