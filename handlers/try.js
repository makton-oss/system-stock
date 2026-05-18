const { withRole } = require("../core/withRole");
const { sendButtons } = require("../utils/sendButtons");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  const action = parts[1]?.toUpperCase();
  
  if (!parts[1]) {
  await sendButtons(
    chatId,
    "🧪 TEST BUTTON\n\nPilih action:",
    [
      { id: "TRY_APPROVE", title: "Approve" },
      { id: "TRY_REJECT", title: "Reject" }
    ]
  );

  await reply(chatId, "📤 BUTTON SENT");
  return res.end();
}

if (action === "TRY_APPROVE") {
  await reply(chatId, "⏳ Processing approve...");
  return res.end();
}

if (action === "TRY_REJECT") {
  await reply(chatId, "⏳ Processing reject...");
  return res.end();
}
  return res.end();
});