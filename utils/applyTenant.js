/**
 * applyTenant
 * Tambah .eq("tenant_id", tenantId) pada Supabase query.
 * Kalau tenantId = null (superadmin) — bypass, return query as-is.
 */
function applyTenant(query, tenantId) {
  if (!tenantId) return query;
  return query.eq("tenant_id", tenantId);
}

module.exports = { applyTenant };