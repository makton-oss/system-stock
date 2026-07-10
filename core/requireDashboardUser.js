const bcrypt = require("bcrypt");
const { getUserByChatId } = require("../db/users/getUserByChatId");

// ======================
// RATE LIMIT — 5 attempts per chat_id, lock 5 mins
// ======================
const loginAttempts = new Map();
const MAX_ATTEMPTS  = 5;
const LOCK_MS       = 5 * 60 * 1000;

function checkLoginRateLimit(chatId) {
  const now   = Date.now();
  const entry = loginAttempts.get(chatId);

  if (!entry) return { allowed: true };

  if (entry.lockedUntil && now < entry.lockedUntil) {
    const minsLeft = Math.ceil((entry.lockedUntil - now) / 60000);
    return { allowed: false, reason: `Terlalu banyak cubaan. Cuba lagi dalam ${minsLeft} minit.` };
  }

  // lock expired — reset
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    loginAttempts.delete(chatId);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(chatId) {
  const now   = Date.now();
  const entry = loginAttempts.get(chatId) || { count: 0 };

  entry.count++;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS;
    entry.count       = 0;
  }

  loginAttempts.set(chatId, entry);
}

function clearAttempts(chatId) {
  loginAttempts.delete(chatId);
}

// cleanup expired locks setiap 10 minit
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts.entries()) {
    if (entry.lockedUntil && now >= entry.lockedUntil) {
      loginAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ======================
// MIDDLEWARE
// ======================
async function requireDashboardUser(req, res, next) {
  const chatId = req.query.chat_id || req.body?.chat_id;

  if (!chatId) {
    return res.status(401).json({ error: "chat_id diperlukan" });
  }

  // rate limit check
  const limitCheck = checkLoginRateLimit(chatId);
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: limitCheck.reason });
  }

  const user = await getUserByChatId(chatId);

  if (!user) {
    recordFailedAttempt(chatId);
    return res.status(403).json({ error: "USER TAK WUJUD / TIDAK AKTIF" });
  }

  if (!["admin", "owner", "superadmin"].includes(user.role)) {
    return res.status(403).json({ error: "NO ACCESS" });
  }

  req.dashboardUser = user;
  next();
}

// ======================
// VERIFY CREDENTIAL — called from login route explicitly
// Returns { ok, mustChangePin }
// ======================
async function verifyDashboardCredential(user, credential) {

  // superadmin — compare against ADMIN_LOG_TOKEN env
  if (user.role === "superadmin") {
    const valid = credential === process.env.ADMIN_LOG_TOKEN;
    if (!valid) {
      recordFailedAttempt(user.chat_id);
      return { ok: false, error: "Token tidak sah" };
    }
    clearAttempts(user.chat_id);
    return { ok: true, mustChangePin: false };
  }

  // admin/owner — compare PIN hash
  if (!user.dashboard_pin_hash) {
    // no PIN set yet — treat as first login with default 123456
    const isDefault = credential === "123456";
    if (!isDefault) {
      recordFailedAttempt(user.chat_id);
      return { ok: false, error: "PIN tidak sah" };
    }
    clearAttempts(user.chat_id);
    return { ok: true, mustChangePin: true };
  }

  const match = await bcrypt.compare(credential, user.dashboard_pin_hash);
  if (!match) {
    recordFailedAttempt(user.chat_id);
    return { ok: false, error: "PIN tidak sah" };
  }

  clearAttempts(user.chat_id);
  return { ok: true, mustChangePin: !!user.pin_must_change };
}

module.exports = { requireDashboardUser, verifyDashboardCredential };