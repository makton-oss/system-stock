function createContext({ chatId, user, parts, res, reply }) {
  return {
    chatId,
    user,
    parts,
    res,
    reply
  };
}

module.exports = { createContext };