const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { rejectRequests } = require("../services/rejectService");
const { writeLog } = require("../utils/formatter");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const arg = parts[1]?.toUpperCase();

  // ======================
  // BUILD QUERY
  // ======================
  let query = supabase
    .from("requests")
    .update({ status: "processing" })
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

  const { data: rows } = await query.select();

  if (!rows?.length) {
    await reply(chatId, "📭 TIADA REQUEST");
    return res.end();
  }

  // ======================
  // PROCESS
  // ======================
  const result = await rejectRequests(rows, chatId);

  if (result.error) {
    console.log("REJECT ERROR:", result.error);
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  // ======================
  // RESPONSE
  // ======================
  if (arg === "ALL") {

    await writeLog(chatId, "manager", "REJECT", `${rows.length} request`);

    await reply(chatId, `❌ REJECTED\n\nTotal: ${rows.length}`);
    return res.end();
  }

  const row = rows[0];

  await writeLog(
    chatId,
    "manager",
    "REJECT",
    `ID${row.id} ${row.item} x${row.qty}`
  );

  await reply(
    chatId,
    `❌ REJECTED\n\nID ${row.id}\n${row.item} x${row.qty}`
  );

  return res.end();
});