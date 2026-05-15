const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { rejectRequests } = require("../services/rejectService");
const { writeLog } = require("../utils/formatter");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const arg = parts[1]?.toUpperCase();

  // ======================
  // FETCH ONLY
  // ======================
  let query = supabase
    .from("requests")
    .select("*")
    .eq("status", "processing")
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
  // PROCESS
  // ======================
  const { logDetails } = await rejectRequests(rows, chatId);

  // ======================
  // RESPONSE
  // ======================
  let text = "❌ REJECTED\n\n";

  logDetails.forEach(l => {
    text += `${l}\n`;
  });

  await writeLog(chatId, "manager", "REJECT", logDetails.join(" | "));
  await reply(chatId, text);

  return res.end();
});