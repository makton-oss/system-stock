const { withRole } = require("../core/withRole");
const { normalizeItem, safeQty } = require("../utils/helpers");
const { createRequest } = require("../services/requestService");

module.exports = withRole(["staff", "manager"], async (ctx) => {
  const { chatId, parts, user, reply, res } = ctx;

  const qty = safeQty(parts.at(-1));
  const item = normalizeItem(parts.slice(1, -1).join(" "));

  if (!item || qty === null) {
    await reply(chatId, "❌ FORMAT: OUT ayam 5");
    return res.end();
  }

  const result = await createRequest({
    item,
    qty,
    type: "out",
    user,
    chatId
  });

  if (result.error === "ITEM_NOT_FOUND") {
    await reply(chatId, `❌ ITEM TAK WUJUD: ${item}`);
    return res.end();
  }

  if (result.error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  await reply(chatId, "✅ REQUEST SENT");
  return res.end();
});