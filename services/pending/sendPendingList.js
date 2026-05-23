const { sendButtons } = require("../notification/buttonService");
const { buildPendingButtons } = require("./buildPendingButtons");
const { buildStockRequestMessage } = require("../../utils/messages/buildStockRequestMessage");

// ======================
// SEND PENDING
// ======================

async function sendPendingList({
  chatId,
  rows
}) {

  // ======================
  // GROUP OUTLET
  // ======================

  const map = {};

  rows.forEach(r => {

    const outlet =
      r.outlets?.name ||
      "Outlet";

    if (!map[outlet]) {
      map[outlet] = [];
    }

    map[outlet].push(r);
  });

  // ======================
  // SEND PER OUTLET
  // ======================

  for (
    const [outletName, list]
    of Object.entries(map)
  ) {

    const text =
      buildStockRequestMessage({
        rows: list,
        outletName
      });

    const buttons =
      buildPendingButtons(
        outletName
      );

    await sendButtons(
      chatId,
      text,
      buttons
    );
  }
}

module.exports = {
  sendPendingList
};