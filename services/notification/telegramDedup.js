// In-memory dedup store
// Cukup untuk production — update_id unique per bot
// Auto-cleanup selepas 5 minit

const seen = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minit

function isDuplicate(updateId) {
  const key = String(updateId);
  const now = Date.now();

  if (seen.has(key)) return true;

  seen.set(key, now);
  return false;
}

// Cleanup expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of seen.entries()) {
    if (now - ts > TTL_MS) seen.delete(key);
  }
}, 60 * 1000);

module.exports = { isDuplicate };