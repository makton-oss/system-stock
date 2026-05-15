const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatStaffList, formatStaffListAdmin } = require("../utils/formatter");

module.exports = withRole(["manager","admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

  // ======================
  // ADMIN → ALL OUTLETS
  // ======================
  if (user.role === "admin") {

    const { data, error } = await supabase
      .from("users")
      .select(`
        chat_id,
        nickname,
        role,
        outlet_id,
        outlets(name)
      `)
      .neq("role", "admin")
      .order("outlet_id", { ascending: true });

    if (error) {
      console.log("STAFF ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    await reply(chatId, formatStaffListAdmin(data));
    return res.end();
  }

  // ======================
  // MANAGER → OWN OUTLET
  // ======================
  const { data, error } = await supabase
    .from("users")
    .select(`
      chat_id,
      nickname,
      role,
      outlets(name)
    `)
    .eq("outlet_id", user.outlet_id)
    .neq("role", "admin");

  if (error) {
    console.log("STAFF ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  await reply(chatId, formatStaffList(data));
  return res.end();
});