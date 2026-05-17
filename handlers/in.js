const { withRole } = require("../core/withRole");
const { normalizeItem, safeQty, notifyManagers } = require("../utils/helpers");
const { createRequest } = require("../services/requestService");
const { getUserDisplay, toProperCase } = require("../utils/formatter");

module.exports = withRole(["staff"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const rawInput = parts.slice(1).join(" ");

  // ======================
  // MULTI MODE DETECTION
  // ======================
  if (rawInput.includes(",")) {

    const segments = rawInput.split(",");

    let successList = [];
    let failedList = [];

    for (let seg of segments) {

      const s = seg.trim().split(" ");
      const qty = safeQty(s.at(-1));
      const item = normalizeItem(s.slice(0, -1).join(" "));

      if (!item || qty === null) {
        failedList.push(seg.trim());
        continue;
      }

      const result = await createRequest({
        item,
        qty,
        type: "in",
        user,
        chatId
      });

      if (result.error) {
        failedList.push(item);
        continue;
      }

      successList.push({ item, qty, id: result.id });
    }

    // ======================
    // RESPONSE (multi)
    // ======================
    let text = `📥 STOCK IN - ${toProperCase(user.outlets?.name || "-")}\n\n`;

    successList.forEach(r => {
      text += `ID ${r.id} ${toProperCase(r.item)} x${r.qty}\n`;
    });

    text += `\nBY: ${toProperCase(user.nickname)} (${chatId})`;

    if (failedList.length) {
      text += `\n\n❌ FAILED\n${failedList.join("\n")}`;
    }

    // notify manager sekali je (summary)
    await notifyManagers(text, user.outlet_id, chatId);

	await reply(
	  chatId,
	  failedList.length
		? `✅ REQUEST SENT\n\n❌ FAILED\n${failedList.join("\n")}`
		: "✅ REQUEST SENT"
	);
    return res.end();
  }

  // ======================
  // 🔥 ORIGINAL FLOW (UNCHANGED)
  // ======================
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

  try {
    const userInfo = await getUserDisplay(chatId);

    const text = `📥 STOCK IN - ${toProperCase(user.outlets?.name || "-")}

ID ${result?.id || "-"} ${toProperCase(item)} x${qty}
BY: ${toProperCase(userInfo.nickname)} (${chatId})`;

    await notifyManagers(text, user.outlet_id, chatId);

  } catch (err) {
    console.log("NOTIFY ERROR (IN):", err);
  }

  await reply(
	  chatId,
	  failedList.length
		? `✅ REQUEST SENT\n\n❌ FAILED\n${failedList.join("\n")}`
		: "✅ REQUEST SENT"
	);
  return res.end();
});