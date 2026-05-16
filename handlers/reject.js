const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { writeLog } = require("../utils/formatter");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const arg = parts[1]?.toUpperCase();

  let query = supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .eq("outlet_id", user.outlet_id);

  if (arg !== "ALL") {
    const id = parseInt(parts[1]);

    if (isNaN(id)) {
      await reply(chatId, "❌ FORMAT: REJECT ALL / REJECT 12");
      return res.end();
    }

    query = query.eq("id", id);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.log("REJECT ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  if (!rows?.length) {
    await reply(chatId, "📭 TIADA DATA");
    return res.end();
  }

  // ======================
  // UPDATE → REJECTED
  // ======================
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
      .eq("status", "pending") // 🔥 penting
      .select();

    if (!updated?.length) continue;

    logDetails.push(`ID${row.id} ${row.item}`);
  }

  await writeLog(chatId, "manager", "REJECT", logDetails.join(" | "));
  await reply(chatId, "❌ REJECTED");

  return res.end();
});