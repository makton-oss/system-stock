const cron = require("node-cron");
const { createInventorySnapshot } = require("../../services/snapshot/createInventorySnapshot");
const { runBackup } = require("./backupJob");

function startCronJobs() {

  console.log("✅ CRON STARTED");

  // snapshot — 11:59 PM
  cron.schedule(
    "59 23 * * *",
    async () => {
      console.log("📸 DAILY SNAPSHOT");
      await createInventorySnapshot();
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );

  // backup — 1:00 AM (selepas snapshot)
  cron.schedule(
    "0 1 * * *",
    async () => {
      console.log("💾 DAILY BACKUP");
      await runBackup();
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );
}

module.exports = startCronJobs;