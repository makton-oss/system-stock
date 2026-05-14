const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatStaff } = require("../utils/formatter");

module.exports = withRole(["manager","admin"], async (ctx) => {

  const { chatId, reply, res } = ctx;

  const { data } = await supabase
    .from("users")
    .select("*");

  await reply(chatId, formatStaff(data));
  return res.end();
});