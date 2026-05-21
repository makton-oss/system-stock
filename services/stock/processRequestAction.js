const { parseRequestAction } = require("./parseRequestAction");
const { getPendingRequestById, getPendingRequestsByOutlet } = require("./requestQuery");
const { getAccessibleOutletIds } = require("../../utils/getAccessibleOutlets");

async function processRequestAction({ raw, user, chatId, reply, mode }) {

  const parsed = parseRequestAction(raw);

  const isAll = parsed?.isAll;
  const targetOutletId = Number(parsed?.outletKey);

  const outletIds = await getAccessibleOutletIds(user);

  let rows = [];

  try {

    // ======================
    // SINGLE
    // ======================

    if (!isAll) {

      const id = parsed?.requestId;

      if (isNaN(id)) {

        await reply(
          chatId,
          `❌ FORMAT: ${mode.toUpperCase()} 12`
        );

        return null;
      }

      const row = await getPendingRequestById(id);

      if (row) {

        if (!outletIds.includes(row.outlet_id)) {

          await reply(chatId, "❌ NO ACCESS");

          return null;
        }

        rows = [row];
      }
    }

    // ======================
    // ALL
    // ======================

    else {

      if (isNaN(targetOutletId)) {

        await reply(chatId, "❌ INVALID OUTLET");

        return null;
      }

      if (!outletIds.includes(targetOutletId)) {

        await reply(chatId, "❌ NO ACCESS");

        return null;
      }

      rows = await getPendingRequestsByOutlet(targetOutletId);
    }

  } catch (err) {

    console.log(`${mode.toUpperCase()} FETCH ERROR:`, err);

    await reply(chatId, "❌ ERROR");

    return null;
  }

  // ======================
  // NO DATA
  // ======================

  if (!rows?.length) {

    await reply(chatId, "📭 TIADA DATA");

    return null;
  }

  return rows;
}

module.exports = {
  processRequestAction
};