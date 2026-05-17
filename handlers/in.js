const { withRole } = require("../core/withRole");
const { normalizeItem, safeQty, notifyManagers } = require("../utils/helpers");
const { createRequest } = require("../services/requestService");
const { getUserDisplay, toProperCase } = require("../utils/formatter");

module.exports = withRole(["staff","manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  // ======================
  // SUPPORT MULTI INPUT
  // ======================
  const input = parts.slice(1).join(" ");

  if (!input) {
    await reply(chatId, "❌ FORMAT: IN ayam 10, ikan 5");
    return res.end();
  }

  const chunks = input.split(",");

  let results = [];
  let failed = [];

  for (let raw of chunks) {

    const segment = raw.trim();

    const segParts = segment.split(" ");
    const qtyRaw = segParts.pop();
    const itemRaw = segParts.join(" ");

    const item = normalizeItem(itemRaw);
    const qty = safeQty(qtyRaw);

    if (!item || !qty) {
      failed.push(segment);
      continue;
    }

    // ======================
    // CALL EXISTING FLOW
    // ======================
    const result = await createRequest({
      item,
      qty,
      type: "in",
      user,
      chatId
    });

    if (result.error) {
      failed.push(toProperCase(item));
      continue;
    }

    // 🔥 IMPORTANT:
    // assume createRequest dah return id (kalau sebelum ni memang ada)
    results.push(result);
  }

  // ======================
  // ORIGINAL DISPLAY STYLE
  // ======================
  let text = `Stock in - ${toProperCase(user.outlets?.name || "-")}\n\n`;

  results.forEach(r => {
    text += `ID ${r.id} | ${toProperCase(r.item)} x ${r.qty}\n`;
  });

  text += `\nBY: ${getUserDisplay(user)}`;

  if (failed.length) {
    text += `\n\n❌ FAILED\n${failed.join("\n")}`;
  }

  await reply(chatId, text);
  return res.end();
});