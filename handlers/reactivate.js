const { withRole } = require("../core/withRole");
const supabase = require("../services/db");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  if (parts.length < 2) {
    await reply(chatId, "❌ FORMAT: REACTIVATE 60123456789");
    return res.end();
  }

  const phone = parts[1];

  const { error } = await supabase
    .from("users")
    .update({ is_active: true })
    .eq("chat_id", phone);

  if (error) {
    console.log("REACTIVATE ERROR:", error);
    await reply(chatId, "❌ ERROR REACTIVATE");
    return res.end();
  }

  await reply(chatId, "✅ USER DIAKTIFKAN SEMULA");
  return res.end();
});