const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");

/**
 * Parse @slug dari hujung string untuk superadmin commands.
 *
 * Contoh:
 *   "outlet_a@kedaiku" → { cleanValue: "outlet_a", tenantId: "uuid-xxx" }
 *   "outlet_a"         → { cleanValue: "outlet_a", tenantId: fallbackTenantId }
 *
 * Untuk non-superadmin, selalu return original value + fallbackTenantId.
 */
async function parseSuperadminTarget(raw = "", isSuperadmin = false, fallbackTenantId = null) {

  // Admin atau tiada @slug → guna fallback (tenant sendiri)
  if (!isSuperadmin || !raw.includes("@")) {
    return { cleanValue: raw, tenantId: fallbackTenantId, error: null };
  }

  // Ambil @slug dari bahagian terakhir (support outlet name yang ada @ e.g. "kedai@ali@slug")
  const atIdx     = raw.lastIndexOf("@");
  const cleanValue = raw.slice(0, atIdx).trim();
  const slug       = raw.slice(atIdx + 1).trim();

  if (!slug) {
    return { cleanValue: raw, tenantId: fallbackTenantId, error: null };
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return { cleanValue, tenantId: null, error: `❌ TENANT TAK WUJUD: ${slug}` };
  }

  return { cleanValue, tenantId: tenant.id, error: null };
}

module.exports = { parseSuperadminTarget };