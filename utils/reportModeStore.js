const store = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minit

module.exports = {
  set: (chatId, mode) => store.set(chatId, { mode, expiry: Date.now() + TTL_MS }),
  get: (chatId) => {
    const entry = store.get(chatId);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      store.delete(chatId);
      return null;
    }
    return entry.mode;
  },
  del: (chatId) => store.delete(chatId)
};