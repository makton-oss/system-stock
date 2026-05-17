function createContext({ chatId, user, parts, body, res, reply }) {
  return {
    chatId,
    user,
    parts,
	body,
    res,
    reply
  };
}

module.exports = { createContext };