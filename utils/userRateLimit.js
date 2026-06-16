const userRequestMap = new Map();

const WINDOW_MS    = 60 * 1000; // 1 minit
const MAX_PER_USER = 15;        // max 15 req/min per chat_id

function checkUserRateLimit(chatId) {

  const now = Date.now();
  const key = String(chatId);

  if (!userRequestMap.has(key)) {
    userRequestMap.set(key, {
      count:   1,
      resetAt: now + WINDOW_MS
    });
    return { allowed: true };
  }

  const entry = userRequestMap.get(key);

  // ======================
  // RESET WINDOW
  // ======================
  if (now > entry.resetAt) {
    entry.count   = 1;
    entry.resetAt = now + WINDOW_MS;
    return { allowed: true };
  }

  entry.count++;

  if (entry.count > MAX_PER_USER) {
    return { allowed: false };
  }

  return { allowed: true };
}

// ======================
// CLEANUP — prevent memory leak
// ======================
setInterval(() => {

  const now = Date.now();

  for (const [key, entry] of userRequestMap.entries()) {
    if (now > entry.resetAt) {
      userRequestMap.delete(key);
    }
  }

}, 5 * 60 * 1000);

module.exports = { checkUserRateLimit };