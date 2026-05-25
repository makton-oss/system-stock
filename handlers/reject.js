const { withRole } = require("../core/withRole");
const { rejectRequest } = require("../services/stock/rejectRequest");
const { processRequestAction } = require("../services/stock/processRequestAction");
const { buildRejectMessage } = require("../utils/messages/buildRejectMessage");
const { writeLog } = require("../utils/formatter");
const { emitEvent } = require("../services/events/emitEvent");


module.exports = withRole(["supervisor", "manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  // ======================
  // REQUEST ACTION
  // ======================

  const raw =
    parts.join(" ");

  const rows = await processRequestAction({ raw, user, chatId, reply, mode: "reject"});

  if (!rows) {
    return res.end();
  }

  // ======================
  // PROCESS REJECT
  // ======================

  const {
    logDetails
  } = await rejectRequest(
    rows,
    chatId
  );

  // ======================
  // RESPONSE
  // ======================

  const text = buildRejectMessage();

  // ======================
  // LOG
  // ======================

  await writeLog(chatId, "manager", "REJECT", logDetails.join(" | "));

  await emitEvent(
    "stock.rejected",
    {
      by: chatId,
      rows: processed
    }
  );

  await reply(chatId, text);

  return res.end();
});