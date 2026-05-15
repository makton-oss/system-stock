const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatPending, formatPendingAdmin } = require("../utils/formatter");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

  // ======================
  // ADMIN → ALL OUTLETS
  // ======================
  if (user.role === "admin") {

    const { data, error } = await supabase
      .from("requests")
      .select(`
        id,
        type,
        item,
        qty,
        created_at,
        outlet_id,
        outlets(name)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.log("LIST ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    await reply(chatId, formatPendingAdmin(data));
    return res.end();
  }

  // ======================
  // STAFF + MANAGER → OWN OUTLET
  // ======================
  const { data, error } = await supabase
    .from("requests")
    .select(`
      id,
      type,
      item,
      qty,
      created_at,
      outlets(name)
    `)
    .eq("outlet_id", user.outlet_id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.log("LIST ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  await reply(chatId, formatPending(data));
  return res.end();
});