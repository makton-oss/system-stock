const { pendingNotifyQueue } = require("./pendingNotifyQueue");
const { notifySmartStock } = require("./smartStockNotifier");

async function queueStockNotification( outletId ) {

  // already waiting
  if (
    pendingNotifyQueue[outletId]
  ) {
    return;
  }

  pendingNotifyQueue[outletId] =
    true;

  setTimeout(async () => {

    try {

      await notifySmartStock(
        outletId
      );

    } catch (err) {

      console.log(
        "QUEUE ERROR:",
        err
      );

    } finally {

      delete pendingNotifyQueue[
        outletId
      ];
    }

  }, 120000); // 2 mins
}

module.exports = {
  queueStockNotification
};