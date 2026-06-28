const { withRole } = require("../core/withRole");
const { approveRequest } = require("../services/stock/approveRequest");
const { processRequestAction } = require("../services/stock/processRequestAction");
const { parseRequestAction } = require("../services/stock/parseRequestAction");
const { notifyManagers } = require("../services/notification/notifyManager");
const { writeLog, formatLowStockAlertGroup } = require("../utils/formatter");
const { buildApproveMessage } = require("../utils/messages/buildApproveMessage");
const { emitEvent } = require("../services/events/emitEvent");
const { withOutletLock } = require("../db/requests/outletLock");

// ======================
// SHARED APPROVAL LOGIC
// ======================
async function handleApproval(rows, ctx) {

  const { chatId, user, reply, res } = ctx;

  const {
    summary,
    logDetails,
    rows: processed,
    lowStockItems,
    processedCount
  } = await approveRequest(rows, chatId, user.tenant_id || null);

  // ======================
  // NOTHING PROCESSED
  // ======================
  if (!processedCount) {
    await reply(chatId, "Request sudah diproses atau tiada request untuk diluluskan.");
    return res.end();
  }

  // ======================
  // LOW STOCK ALERT (CONSOLIDATED)
  // ======================
  const lowStockByOutlet = {};

  for (const item of lowStockItems) {
    const outletId = item.outlet_id;
    if (!lowStockByOutlet[outletId]) lowStockByOutlet[outletId] = [];
    lowStockByOutlet[outletId].push(item);
  }

  for (const [outletId, items] of Object.entries(lowStockByOutlet)) {
    const alertText = formatLowStockAlertGroup(items);
    await notifyManagers(alertText, Number(outletId), chatId, user.tenant_id || null, ctx.channel || "botcommerce");
  }

  // ======================
  // RESPONSE
  // ======================
  const text = buildApproveMessage(summary);

  // ======================
  // LOG
  // ======================
  await writeLog(chatId, user.role, "APPROVE", logDetails.join(" | "), user.tenant_id || null);

  await emitEvent("stock.approved", {
    by:   chatId,
    rows: processed
  });

  await reply(chatId, text);

  return res.end();
}

// ======================
// HANDLER
// ======================
module.exports = withRole(["supervisor", "manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const raw    = parts.join(" ");
  const parsed = parseRequestAction(raw);

  // ======================
  // SINGLE APPROVE — no lock needed
  // ======================
  if (!parsed?.isAll) {

    const rows = await processRequestAction({
      raw,
      user,
      chatId,
      reply,
      mode: "approve"
    });

    if (!rows) return res.end();

    return await handleApproval(rows, ctx);
  }

  // ======================
  // APPROVE ALL — advisory lock
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
        mode: "approve"
      });
    });

  } catch (err) {

    if (err.message === "OUTLET_LOCKED") {
      await reply(chatId, "⏳ Request tersebut sedang diproses.");
      return res.end();
    }

    console.log("APPROVE LOCK ERROR:", err);
    await reply(chatId, "❌ SYSTEM ERROR");
    return res.end();
  }

  if (!rows) return res.end();

  return await handleApproval(rows, ctx);
});