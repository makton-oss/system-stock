const cron = require("node-cron");
const { createInventorySnapshot } = require("../../services/snapshot/createInventorySnapshot");
const { runBackup } = require("./backupJob");
const supabase = require("../../services/db");

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

  // trim message logs — 1:30 AM (buang log lebih 30 hari)
  cron.schedule(
    "30 1 * * *",
    async () => {
      console.log("🧹 TRIM MESSAGE LOGS");
      await supabase.rpc("trim_message_logs");
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );
}

module.exports = startCronJobs;