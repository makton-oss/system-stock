const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatPending } = require("../utils/formatter");

module.exports = withRole(["staff","manager","admin"], async (ctx) => {
  const { chatId, user, reply, res } = ctx;

  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .eq("outlet_id", user.outlet_id);

  await reply(chatId, formatPending(data));
  return res.end();
});