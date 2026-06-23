const { normalizeItem, safeQty } = require("../../utils/helpers");
const { createRequest } = require("../../services/stock/createRequest");
const { queueStockNotification } = require("../../services/notification/queueStockNotification");

const EMOJI = {
  in:      "📥",
  out:     "📤",
  wastage: "🗑️"
};

async function handleStockRequest(type, ctx) {

  const { chatId, parts, user, reply, res, channel } = ctx;

  const rawInput = parts.slice(1).join(" ");

  // ======================
  // MULTI MODE
  // ======================
  if (rawInput.includes(",")) {

    const segments = rawInput
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const parsed = [];

    // ======================
    // PHASE 1: VALIDATE
    // ======================
    for (const seg of segments) {

      const s    = seg.split(" ");
      const qty  = safeQty(s.at(-1));
      const item = normalizeItem(s.slice(0, -1).join(" "));

      if (!item || qty === null) {
        await reply(chatId, `❌ FORMAT SALAH: ${seg}`);
        return res.end();
      }

      const test = await createRequest({
        item,
        qty,
        type,
        user,
        chatId,
        validateOnly: true
      });

      if (test.error) {
        await reply(chatId, `❌ ITEM TAK SAH: ${item}`);
        return res.end();
      }

      parsed.push({ item, qty });
    }

    // ======================
    // PHASE 2: EXECUTE
    // ======================
    const successList = [];

    for (const p of parsed) {

      const result = await createRequest({
        item: p.item,
        qty:  p.qty,
        type,
        user,
        chatId
      });

      successList.push({ item: p.item, qty: p.qty, id: result.id });
    }

    // Pass channel supaya manager dapat notification kat channel yang sama
    await queueStockNotification(user.outlet_id, user.tenant_id || null, channel);

    const emoji = EMOJI[type];
    const lines = successList.map(p => `${emoji} ${p.item} x${p.qty}`).join("\n");
    await reply(chatId, `✅ REQUEST SENT\n\n${lines}`);

    return res.end();
  }

  // ======================
  // SINGLE MODE
  // ======================
  const qty  = safeQty(parts.at(-1));
  const item = normalizeItem(parts.slice(1, -1).join(" "));

  if (!item || qty === null) {
    await reply(chatId, `❌ FORMAT: ${type.toUpperCase()} ayam 5`);
    return res.end();
  }

  const result = await createRequest({ item, qty, type, user, chatId });

  if (result.error === "INVALID_QTY") {
    await reply(chatId, "❌ QTY TIDAK SAH");
    return res.end();
  }

  if (result.error === "ITEM_NOT_FOUND") {
    await reply(chatId, `❌ ITEM TAK WUJUD: ${item}`);
    return res.end();
  }

  if (result.error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  // Pass channel supaya manager dapat notification kat channel yang sama
  await queueStockNotification(user.outlet_id, user.tenant_id || null, channel);
  await reply(chatId, "✅ REQUEST SENT");

  return res.end();
}

module.exports = { handleStockRequest };
