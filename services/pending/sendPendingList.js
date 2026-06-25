const { sendButtonsRouter } = require("../notification/notificationRouter");
const { buildPendingButtons } = require("./buildPendingButtons");
const { buildStockRequestMessage } = require("../../utils/messages/buildStockRequestMessage");

// ======================
// SEND PENDING
// ======================

async function sendPendingList({ chatId, rows, channel = "botcommerce" }) {

  // ======================
  // GROUP OUTLET
  // ======================

  const map = {};

  rows.forEach(r => {

    const outlet = r.outlets?.name || "Outlet";
    if (!map[outlet]) {
      map[outlet] = [];
    }
    map[outlet].push(r);
  });

  // ======================
  // SEND PER OUTLET
  // ======================

  // NEW — get outletId from first row in the group
  for (const [outletName, list] of Object.entries(map)) {
    const outletId = list[0].outlet_id; // all rows in group share same outlet_id
    const text     = buildStockRequestMessage({ rows: list, outletName });
    const buttons  = buildPendingButtons(outletName, outletId);
    await sendButtonsRouter(chatId, text, buttons, channel);
  }
}

module.exports = {
  sendPendingList
};
