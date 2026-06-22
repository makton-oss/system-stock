const { withRole } = require("../core/withRole");
const { sendButtonsRouter } = require("../services/notification/notificationRouter");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {

  const { chatId, parts, reply, res, channel } = ctx;

  const action = parts[1]?.toUpperCase(); // jangan uppercase dulu (nak exact match)

  // ======================
  // 🔘 HANDLE POSTBACK
  // ======================
  if (action === "TRY_APPROVE") {
    await reply(chatId, "✅ POSTBACK APPROVE RECEIVED");
    return res.end();
  }

  if (action === "TRY_REJECT") {
    await reply(chatId, "❌ POSTBACK REJECT RECEIVED");
    return res.end();
  }

  // ======================
  // 🚀 SEND BUTTON (POSTBACK STYLE)
  // ======================
  await sendButtonsRouter(
    chatId,
    "🧪 TEST POSTBACK BUTTON\n\nPilih action:",
    [
      { id: "TRY_APPROVE", title: "Approve" },
      { id: "TRY_REJECT", title: "Reject" }
    ],
    channel
  );

  return res.end();
});