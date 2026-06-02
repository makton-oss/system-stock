const { withRole } = require("../core/withRole");
const supabase = require("../services/db");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  // FORMAT: REMOVEOUTLET 60123456789 outletname
  if (parts.length < 3) {
    await reply(chatId, "❌ FORMAT: REMOVEOUTLET 60123456789 outletname");
    return res.end();
  }

  const phone = parts[1];
  const outletName = parts.slice(2).join(" ");

  // ======================
  // GET OUTLET
  // ======================
  const { data: outlet } = await supabase
    .from("outlets")
    .select("id, name")
    .ilike("name", outletName)
    .maybeSingle();

  if (!outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  // ======================
  // REMOVE LINK
  // ======================
  const { error } = await supabase
    .from("user_outlets")
    .delete()
    .eq("user_chat_id", phone)
    .eq("outlet_id", outlet.id);

  if (error) {
    console.log("REMOVEOUTLET ERROR:", error);
    await reply(chatId, "❌ ERROR REMOVE OUTLET");
    return res.end();
  }

  await reply(chatId, `✅ OUTLET ${outlet.name} DIBUANG DARI ${phone}`);
  return res.end();
});