const { withRole } = require("../core/withRole");
const { rejectRequest } = require("../services/stock/rejectRequest");
const { processRequestAction } = require("../services/stock/processRequestAction");
const { parseRequestAction } = require("../services/stock/parseRequestAction");
const { buildRejectMessage } = require("../utils/messages/buildRejectMessage");
const { writeLog } = require("../utils/formatter");
const { emitEvent } = require("../services/events/emitEvent");
const { withOutletLock } = require("../db/requests/outletLock");

// ======================
// SHARED REJECT LOGIC
// ======================
async function handleRejection(rows, ctx) {

  const { chatId, user, reply, res } = ctx;

  const {
    logDetails,
    rows: processed
  } = await rejectRequest(
    rows,
    chatId,
    user.tenant_id || null
  );

  // ======================
  // RESPONSE
  // ======================
  const text = buildRejectMessage();

  // ======================
  // LOG
  // ======================
  await writeLog(chatId, user.role, "REJECT", logDetails.join(" | "), user.tenant_id || null);
  await emitEvent("stock.rejected", { by: chatId, rows: processed, channel: ctx.channel || "botcommerce" });
  await reply(chatId, text);

  return res.end();
}

// ======================
// HANDLER
// ======================
module.exports = withRole(["supervisor", "manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const raw = parts.join(" ");
  const parsed = parseRequestAction(raw);

  // ======================
  // SINGLE REJECT — no lock needed
  // row-level atomic lock in rejectRequest() cukup
  // ======================
  if (!parsed?.isAll) {

    const rows = await processRequestAction({
      raw,
      user,
      chatId,
      reply,
      mode: "reject"
    });

    if (!rows) return res.end();

    return await handleRejection(rows, ctx);
  }

  // ======================
  // REJECT ALL — advisory lock
  // ======================
  const outletId = Number(parsed.outletKey);

  if (isNaN(outletId)) {
    await reply(chatId, "❌ INVALID OUTLET");
    return res.end();
  }

  let rows;

  try {

    rows = await withOutletLock(outletId, async () => {

      return await processRequestAction({
        raw,
        user,
        chatId,
        reply,
        mode: "reject"
      });
    });

  } catch (err) {

    if (err.message === "OUTLET_LOCKED") {
      await reply(chatId, "⏳ Request tersebut sedang diproses.");
      return res.end();
    }

    console.log("REJECT LOCK ERROR:", err);
    await reply(chatId, "❌ SYSTEM ERROR");
    return res.end();
  }

  if (!rows) return res.end();

  return await handleRejection(rows, ctx);
});