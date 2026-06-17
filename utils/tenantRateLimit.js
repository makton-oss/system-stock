const tenantRequestMap = new Map();

const WINDOW_MS      = 60 * 1000;
const MAX_PER_TENANT = 100; // 100 req/min per tenant

function checkTenantRateLimit(tenantId) {

  // superadmin — no limit
  if (!tenantId) return { allowed: true };

  const now = Date.now();
  const key = String(tenantId);

  if (!tenantRequestMap.has(key)) {
    tenantRequestMap.set(key, {
      count:   1,
      resetAt: now + WINDOW_MS
    });
    return { allowed: true };
  }

  const entry = tenantRequestMap.get(key);

  if (now > entry.resetAt) {
    entry.count   = 1;
    entry.resetAt = now + WINDOW_MS;
    return { allowed: true };
  }

  entry.count++;

  if (entry.count > MAX_PER_TENANT) {
    return { allowed: false };
  }

  return { allowed: true };
}

// ======================
// CLEANUP
// ======================
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tenantRequestMap.entries()) {
    if (now > entry.resetAt) {
      tenantRequestMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = { checkTenantRateLimit };