const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatPending } = require("../utils/formatter");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {
  const { chatId, user, reply, res } = ctx;

  const { data } = await supabase
	  .from("requests")
	  .select(`
		id,
		type,
		item,
		qty,
		created_at,
		outlets(name)
	  `)
	  .eq("outlet_id", ctx.user.outlet_id)
	  .order("id", { ascending: true });

  await reply(chatId, formatPending(data));
  return res.end();
});