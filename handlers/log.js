const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatLogs } = require("../utils/formatter");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, reply, res } = ctx;

  const { data } = await supabase
    .from("logs")
    .select("*")
    .order("id", { ascending: false })
    .limit(20);

  const text = await formatLogs(data);

  await reply(chatId, text);
  return res.end();
});