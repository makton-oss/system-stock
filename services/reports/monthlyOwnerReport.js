const { getOwnerReport } = require("./ownerSummary");
const { getLowStockSnapshot } = require("../../db/stock/getLowStockSnapshot");
const { getTenantWithPlan } = require("../../db/tenants/getTenantWithPlan");
const { generateInsights, getBusinessHealth } = require("./generateInsights");
const { DateTime } = require("luxon");

async function getMonthlyOwnerReport({ mode, monthInput, outletIds, tenantId }) {

  const ownerResult = await getOwnerReport({ mode, monthInput, outletIds, tenantId });
  if (ownerResult.error) return { error: ownerResult.error };

  // snapshot date = end of period being reported (fallback yesterday if current month)
  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");
  const snapshotDate = mode === "monthly" && monthInput
    ? null // TODO: derive from monthInput if needed for historical months
    : now.minus({ days: 1 }).toFormat("yyyy-MM-dd");

  const lowStockResult = snapshotDate
    ? await getLowStockSnapshot({ outletIds, tenantId, snapshotDate })
    : { items: [] };

  if (lowStockResult.error) return { error: lowStockResult.error };

  // tenant thresholds — null tenantId (superadmin global) skip lookup
  const tenant = tenantId ? await getTenantWithPlan(tenantId).catch(() => null) : null;

  const avgWastagePercent = ownerResult.data.length
    ? ownerResult.data.reduce((a, o) => a + o.wastagePercent, 0) / ownerResult.data.length
    : 0;

  const insights = generateInsights({
    comparison: ownerResult.data,
    lowStockCount: lowStockResult.items.length,
    tenant
  });

  const health = getBusinessHealth({ avgWastagePercent, lowStockCount: lowStockResult.items.length });

  return {
    data: ownerResult.data,
    label: ownerResult.label,
    lowStock: lowStockResult.items,
    snapshotDate,
    insights,
    health
  };
}

module.exports = { getMonthlyOwnerReport };