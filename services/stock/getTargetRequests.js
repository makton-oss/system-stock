const { getPendingRequestById, getPendingRequestsByOutlet } = require("./requestQuery");

async function getTargetRequests({ actionData, outletIds }) {

  // ======================
  // SINGLE
  // ======================

  if (!actionData.isAll) {

    const row =
      await getPendingRequestById(
        actionData.requestId
      );

    if (!row) {
      return [];
    }

    if (!outletIds.includes(row.outlet_id)) {
      throw new Error("NO_ACCESS");
    }

    return [row];
  }

  // ======================
  // ALL
  // ======================

  const outletId =
    Number(actionData.outletKey);

  if (isNaN(outletId)) {
    throw new Error("INVALID_OUTLET");
  }

  if (!outletIds.includes(outletId)) {
    throw new Error("NO_ACCESS");
  }

  return await getPendingRequestsByOutlet(
    outletId
  );
}

module.exports = {
  getTargetRequests
};