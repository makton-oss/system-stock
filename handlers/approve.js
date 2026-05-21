const { withRole } = require("../core/withRole");
const { approveRequest } = require("../services/stock/approveRequest");
const { processRequestAction } = require("../services/stock/processRequestAction");
const { notifyManagers } = require("../services/notification/notifyManager");
const { writeLog , formatLowStockAlert } = require("../utils/formatter");
const { buildApproveMessage } = require("../utils/messages/buildApproveMessage");
const { emitEvent } = require("../services/events/emitEvent");

module.exports = withRole(["supervisor", "manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  // ======================
  // REQUEST ACTION
  // ======================

  const raw =
    parts.join(" ");

  const rows =
    await processRequestAction({
      raw,
      user,
      chatId,
      reply,
      mode: "approve"
    });

  if (!rows) {
    return res.end();
  }

  // ======================
  // PROCESS APPROVAL
  // ======================

  const {
    summary,
    logDetails,
    rows: processed
  } = await approveRequest(
    rows,
    chatId
  );

  // ======================
  // LOW STOCK ALERT
  // ======================

  for (const r of processed) {

    if (!r._lowStock) continue;

    const alertText =
      formatLowStockAlert(
        r._lowStock.item,
        r._lowStock.qty,
        r._lowStock.min
      );

    await notifyManagers(
      alertText,
      r._lowStock.outlet_id
    );
  }

  // ======================
  // RESPONSE
  // ======================
  const text = buildApproveMessage(summary);

  // ======================
  // LOG
  // ======================

  await writeLog(chatId, "manager", "APPROVE", logDetails.join(" | "));

  await emitEvent(
    "stock.approved",
    {
      by: chatId,
      rows: processed
    }
  );

  await reply(chatId, text);

  return res.end();
});