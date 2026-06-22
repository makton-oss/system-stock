const { withRole } = require("../core/withRole");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getPendingRequests } = require("../services/pending/getPendingRequests");
const { sendPendingList } = require("../services/pending/sendPendingList");

module.exports =
withRole(["supervisor", "manager"],
async (ctx) => {

  const { chatId, user, reply, res, channel } = ctx;

  // ======================
  // ACCESS
  // ======================

  const outletIds = await getAccessibleOutletIds(user);

  // ======================
  // GET DATA
  // ======================

  const { data, error } = await getPendingRequests({ user, outletIds });

  if (error) {

    console.log(
      "PENDING ERROR:",
      error
    );

    await reply(
      chatId,
      "❌ ERROR",
      channel
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
    rows: data,
    channel
  });

  return res.end();
});