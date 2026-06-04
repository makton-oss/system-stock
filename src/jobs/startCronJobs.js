const cron = require("node-cron");
const { createInventorySnapshot } = require("../../services/snapshot/createInventorySnapshot");

function startCronJobs()
{
  console.log(
    "✅ CRON STARTED"
  );

  cron.schedule(
    "59 23 * * *",
    async () =>
    {
      console.log("📸 DAILY SNAPSHOT");
      await createInventorySnapshot();
    },
    {
      timezone:
        "Asia/Kuala_Lumpur"
    }
  );
}

module.exports =
  startCronJobs;