const { withRole } = require("../core/withRole");
const { getLogs } = require("../db/logs/getLogs");
const { formatLogs } = require("../utils/formatter");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;
  const tenantId = user.tenant_id || null;

  const data = await getLogs(tenantId, 20);
  const text = await formatLogs(data);

  await reply(chatId, text);
  return res.end();
});