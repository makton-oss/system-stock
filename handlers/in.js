const { withRole } = require("../core/withRole");
const { normalizeItem, safeQty } = require("../utils/helpers");
const { createRequest } = require("../services/stock/createRequest");
const { queueStockNotification } = require("../services/notification/queueStockNotification");

module.exports = withRole(["staff"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const rawInput = parts.slice(1).join(" ");

  // ======================
  // MULTI MODE DETECTION
  // ======================
  if (rawInput.includes(",")) {

	  const segments = rawInput
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);

	  let parsed = [];

	  // ======================
	  // 🔍 PHASE 1: VALIDATE
	  // ======================
	  for (let seg of segments) {

		const s = seg.split(" ");
		const qty = safeQty(s.at(-1));
		const item = normalizeItem(s.slice(0, -1).join(" "));

		if (!item || qty === null) {
		  await reply(chatId, `❌ FORMAT SALAH: ${seg}`);
		  return res.end();
		}

		const test = await createRequest({
		  item,
		  qty,
		  type: "in",
		  user,
		  chatId,
		  validateOnly: true // 🔥 IMPORTANT (explained below)
		});

		if (test.error) {
		  await reply(chatId, `❌ ITEM TAK SAH: ${item}`);
		  return res.end();
		}

		parsed.push({ item, qty });
	  }

	  // ======================
	  // 🚀 PHASE 2: EXECUTE
	  // ======================
	  let successList = [];

	  for (let p of parsed) {

		const result = await createRequest({
		  item: p.item,
		  qty: p.qty,
		  type: "in",
		  user,
		  chatId
		});

		successList.push({
		  item: p.item,
		  qty: p.qty,
		  id: result.id
		});
	  }

	  // ======================
	  // RESPONSE
	  // ======================
	  await queueStockNotification(user.outlet_id);

	  await reply(chatId, "✅ REQUEST SENT");
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

  	await queueStockNotification(user.outlet_id);

  	await reply(chatId, "✅ REQUEST SENT");
	return res.end();
});