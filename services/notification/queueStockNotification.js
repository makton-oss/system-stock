const { pendingNotifyQueue } = require("./pendingNotifyQueue");
const { notifySmartStock } = require("./smartStockNotifier");

const QUEUE_DELAY = 1 * 60 * 1000; // 1 minit

async function queueStockNotification(outletId) {

  // ======================
  // CLEAR EXISTING TIMER (DEBOUNCE)
  // ======================
  if (pendingNotifyQueue[outletId]) {
    clearTimeout(pendingNotifyQueue[outletId]);
  }

  // ======================
  // SET NEW TIMER
  // ======================
  pendingNotifyQueue[outletId] = setTimeout(async () => {

    try {
      await notifySmartStock(outletId);
    } catch (err) {
      console.log("QUEUE ERROR:", err);
    } finally {
      delete pendingNotifyQueue[outletId];
    }

  }, QUEUE_DELAY);
}

module.exports = {
  queueStockNotification
};