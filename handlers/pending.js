const { withRole } = require("../core/withRole");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");
const { getPendingRequests } = require("../services/pending/getPendingRequests");
const { sendPendingList } = require("../services/pending/sendPendingList");

module.exports =
withRole(["supervisor", "manager", "admin"],
async (ctx) => {

  const {
    chatId,
    user,
    reply,
    res
  } = ctx;

  // ======================
  // ACCESS
  // ======================

  const outletIds =
    await getAccessibleOutletIds(
      user
    );

  // ======================
  // GET DATA
  // ======================

  const {
    data,
    error
  } =
    await getPendingRequests({
      user,
      outletIds
    });

  if (error) {

    console.log(
      "PENDING ERROR:",
      error
    );

    await reply(
      chatId,
      "❌ ERROR"
    );

    return res.end();
  }

  if (!data?.length) {

    await reply(
      chatId,
      "📭 TIADA REQUEST"
    );

    return res.end();
  }

  // ======================
  // SEND UI
  // ======================

  await sendPendingList({
    chatId,
    rows: data
  });

  return res.end();
});