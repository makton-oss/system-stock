const { withRole } = require("../core/withRole");
const { sendButtons } = require("../utils/sendButtons");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

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
  await sendButtons(
    chatId,
    "🧪 TEST POSTBACK BUTTON\n\nPilih action:",
    [
      { id: "TRY_APPROVE", title: "Approve" },
      { id: "TRY_REJECT", title: "Reject" }
    ]
  );

  return res.end();
});