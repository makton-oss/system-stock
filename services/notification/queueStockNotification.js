const { pendingNotifyQueue } = require("./pendingNotifyQueue");
const { notifySmartStock } = require("./smartStockNotifier");

const QUEUE_DELAY = 1 * 60 * 1000; // 1 minit

async function queueStockNotification(outletId, tenantId = null) {

  const key = `${tenantId || "null"}_${outletId}`;

  // ======================
  // CLEAR EXISTING TIMER (DEBOUNCE)
  // ======================
  if (pendingNotifyQueue[key]) {
    clearTimeout(pendingNotifyQueue[key]);
  }

  // ======================
  // SET NEW TIMER
  // ======================
  pendingNotifyQueue[key] = setTimeout(async () => {

    try {
      await notifySmartStock(outletId, tenantId);
    } catch (err) {
      console.log("QUEUE ERROR:", err);
    } finally {
      delete pendingNotifyQueue[key];
    }

  }, QUEUE_DELAY);
}

module.exports = { queueStockNotification };