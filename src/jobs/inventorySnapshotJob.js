const {
  createInventorySnapshot
} = require(
  "../services/snapshot/createInventorySnapshot"
);

(async () => {

  console.log(
    "RUNNING INVENTORY SNAPSHOT..."
  );

  await createInventorySnapshot();

  process.exit(0);

})();