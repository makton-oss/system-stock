const { withRole } = require("../core/withRole");
const { sendButtons } = require("../utils/sendButtons");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  const action = parts[1]?.toUpperCase();

  if (action === "APPROVE") {
    await reply(chatId, "✅ BUTTON APPROVE RECEIVED");
    return res.end();
  }

  if (action === "REJECT") {
    await reply(chatId, "❌ BUTTON REJECT RECEIVED");
    return res.end();
  }

  // send button
  await sendButtons(
    chatId,
    "🧪 TEST BUTTON\n\nPilih action:",
    [
      { id: "TRY_APPROVE", title: "Approve" },
      { id: "TRY_REJECT", title: "Reject" }
    ]
  );

  return res.end();
});