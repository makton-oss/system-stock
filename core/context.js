function createContext({ chatId, user, parts, message, res, reply, channel }) {
  return {
    chatId,
    user,
    tenant_id: user?.tenant_id || null,
    parts,
	  message,
    res,
    reply,
    channel: channel || "botcommerce" // "meta" | "botcommerce"
  };
}

module.exports = { createContext };