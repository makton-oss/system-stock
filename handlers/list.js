const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatPending, formatPendingAdmin } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

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
        outlets(name),
        users(nickname, chat_id)
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

  const outletIds = await getAccessibleOutletIds(user);

  const { data, error } = await supabase
    .from("requests")
    .select(`
      id,
      type,
      item,
      qty,
      created_at,
      outlet_id,
      outlets(name),
      users(nickname, chat_id)
    `)
    .in("outlet_id", outletIds)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.log("LIST ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  const uniqueOutlet = [...new Set(data.map(r => r.outlet_id))];

	if (uniqueOutlet.length > 1) {
	  await reply(chatId, formatPendingAdmin(data));
	} else {
	  await reply(chatId, formatPending(data));
	}
  return res.end();
});