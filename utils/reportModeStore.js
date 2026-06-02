const store = new Map();

module.exports = {
  set: (chatId, mode) => store.set(chatId, mode),
  get: (chatId) => store.get(chatId),
  del: (chatId) => store.delete(chatId)
};