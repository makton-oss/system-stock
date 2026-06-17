function createContext({ chatId, user, parts, body, res, reply }) {
  return {
    chatId,
    user,
    tenant_id: user?.tenant_id || null,
    parts,
	  message,
    res,
    reply
  };
}

module.exports = { createContext };