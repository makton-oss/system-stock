require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { createInventorySnapshot } = require("../services/snapshot/createInventorySnapshot");

(async () => {

  console.log(
    "RUNNING INVENTORY SNAPSHOT..."
  );

  await createInventorySnapshot();

  process.exit(0);

})();