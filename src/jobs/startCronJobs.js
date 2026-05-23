const cron = require("node-cron");
const { createInventorySnapshot } = require("../services/snapshot/createInventorySnapshot");

// ======================
// MONTHLY SNAPSHOT
// every 1st day 12:05 AM
// ======================

cron.schedule(
  "5 0 1 * *",
  async () => {

    console.log(
      "RUNNING INVENTORY SNAPSHOT..."
    );

    try {

      await createInventorySnapshot();

      console.log(
        "SNAPSHOT SUCCESS"
      );

    } catch (err) {

      console.log(
        "SNAPSHOT ERROR:",
        err
      );
    }
  },
  {
    timezone: "Asia/Kuala_Lumpur"
  }
);

console.log("CRON JOBS STARTED");