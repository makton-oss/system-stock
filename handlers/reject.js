const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { writeLog } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["supervisor" , "manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  // ======================
  // BUTTON PARSE
  // ======================
  const raw = parts.join(" ");

  const isAll = raw.startsWith("REJECT_ALL_");

  let targetOutletId = null;

  if (isAll) {
    targetOutletId = Number(
      raw.replace("REJECT_ALL_", "")
    );
  }

  // ======================
  // ACCESSIBLE OUTLETS
  // ======================
  const outletIds = await getAccessibleOutletIds(user);

  let query = supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .in("outlet_id", outletIds);

  // ======================
  // SINGLE REJECT
  // ======================
  if (!isAll) {

    const id = Number(parts[1]);

    if (isNaN(id)) {
      await reply(chatId, "❌ FORMAT: REJECT 12");
      return res.end();
    }

    query = query.eq("id", id);
	
	if (!outletIds.includes(targetOutletId)) {
	  await reply(chatId, "❌ NO ACCESS");
	  return res.end();
	}

  }

  // ======================
  // REJECT ALL BY OUTLET
  // ======================
  else {

    if (isNaN(targetOutletId)) {
      await reply(chatId, "❌ INVALID OUTLET");
      return res.end();
    }

    query = query.eq("outlet_id", targetOutletId);
  }

  // ======================
  // FETCH
  // ======================
  const { data: rows, error } = await query;

  if (error) {
    console.log("REJECT FETCH ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  if (!rows?.length) {
    await reply(chatId, "📭 TIADA DATA");
    return res.end();
  }

  // ======================
  // PROCESS REJECT
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
      .eq("status", "pending")
      .select();

    // dah kena process
    if (!updated?.length) continue;

    logDetails.push(`ID${row.id} ${row.item}`);
  }

  // ======================
  // LOG
  // ======================
  await writeLog(
    chatId,
    "manager",
    "REJECT",
    logDetails.join(" | ")
  );

  // ======================
  // RESPONSE
  // ======================
  await reply(chatId, "✅ REJECTED");

  return res.end();
});