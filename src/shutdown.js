const { pendingNotifyQueue } = require("../services/notification/pendingNotifyQueue");

let isShuttingDown = false;

function isShutdown() {
  return isShuttingDown;
}

async function gracefulShutdown(server) {

  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("⚠️ GRACEFUL SHUTDOWN INITIATED");

  // ======================
  // CLEAR PENDING NOTIFY TIMERS
  // ======================
  for (const key of Object.keys(pendingNotifyQueue)) {
    clearTimeout(pendingNotifyQueue[key]);
    delete pendingNotifyQueue[key];
    console.log(`🧹 CLEARED NOTIFY TIMER: ${key}`);
  }

  // ======================
  // STOP ACCEPTING NEW REQUESTS
  // ======================
  server.close(() => {
    console.log("✅ SERVER CLOSED — no new connections");
  });

  // ======================
  // WAIT FOR ACTIVE REQUESTS — max 10 seconds
  // ======================
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log("✅ SHUTDOWN COMPLETE");
  process.exit(0);
}

module.exports = { gracefulShutdown, isShutdown };