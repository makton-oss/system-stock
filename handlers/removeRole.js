const { withRole } = require("../core/withRole");
const supabase = require("../services/db");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  // FORMAT: REMOVEROLE phone
  if (parts.length < 2) {
    await reply(chatId, "❌ FORMAT: REMOVEROLE 60123456789");
    return res.end();
  }

  const phone = parts[1];

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("chat_id", phone);

  if (error) {
    console.log("REMOVE ERROR:", error);
    await reply(chatId, "❌ ERROR REMOVE ROLE");
    return res.end();
  }

  await reply(chatId, "✅ USER DI BUANG");
  return res.end();
});