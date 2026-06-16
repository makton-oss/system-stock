const { getPendingById }     = require("../../db/requests/getPendingById");
const { getPendingByOutlet } = require("../../db/requests/getPendingByOutlet");

async function getTargetRequests({ actionData, outletIds }) {

  // ======================
  // SINGLE
  // ======================

  if (!actionData.isAll) {

    const row   = await getPendingById(actionData.requestId);

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

  return await getPendingByOutlet(outletId);
}

module.exports = {
  getTargetRequests
};