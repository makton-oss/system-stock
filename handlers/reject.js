const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { writeLog } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const arg = parts[1]?.toUpperCase();

  const outletIds = await getAccessibleOutletIds(user);

  let query = supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .in("outlet_id", outletIds);

  if (arg !== "ALL") {
    const id = parseInt(parts[1]);

    if (isNaN(id)) {
      await reply(chatId, "❌ FORMAT: REJECT ALL / REJECT 12");
      return res.end();
    }

    query = query.eq("id", id);
  }

  const { data: rows } = await query;

  if (!rows?.length) {
    await reply(chatId, "📭 TIADA DATA");
    return res.end();
  }

  let logDetails = [];

  for (const row of rows) {

    const { data: updated } = await supabase
      .from("requests")
      .update({
        status: "rejected",
        processed_by: chatId,
        processed_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select();

    if (!updated?.length) continue;

    logDetails.push(`ID${row.id} ${row.item}`);
  }

  await writeLog(chatId, "manager", "REJECT", logDetails.join(" | "));
  await reply(chatId, "✅ REJECTED");

  return res.end();
});