const { withRole } = require("../core/withRole");
const { normalizeItem, safeQty, notifyManagers } = require("../utils/helpers");
const { createRequest } = require("../services/requestService");
const { getUserDisplay, toProperCase } = require("../utils/formatter");

module.exports = withRole(["staff", "manager"], async (ctx) => {
  const { chatId, parts, user, reply, res } = ctx;

  const qty = safeQty(parts.at(-1));
  const item = normalizeItem(parts.slice(1, -1).join(" "));

  if (!item || qty === null) {
    await reply(chatId, "❌ FORMAT: IN ayam 5");
    return res.end();
  }

  const result = await createRequest({
    item,
    qty,
    type: "in",
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

  // ======================
  // NOTIFY MANAGERS
  // ======================
  try {
    const userInfo = await getUserDisplay(chatId);

    const text = `📥 STOCK IN - ${toProperCase(user.outlets?.name || "-")}

ID ${result?.id || "-"} ${toProperCase(item)} x${qty}
BY: ${toProperCase(userInfo.nickname)} (${chatId})`;

    await notifyManagers(text, user.outlet_id, chatId);

  } catch (err) {
    console.log("NOTIFY ERROR (IN):", err);
  }

  // ======================
  // RESPONSE
  // ======================
  await reply(chatId, "✅ REQUEST SENT");
  return res.end();
});