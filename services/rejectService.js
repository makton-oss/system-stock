const supabase = require("./db");

async function rejectRequests(rows, chatId) {

  let logDetails = [];

  for (const row of rows) {

    // ======================
    // 🔥 LOCK ROW (ANTI DOUBLE REJECT)
    // ======================
    const { data: updated } = await supabase
      .from("requests")
      .update({
        status: "rejected",
        processed_by: chatId,
        processed_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .eq("status", "pending") // 🔥 critical lock
      .select();

    // kalau dah process → skip
    if (!updated?.length) continue;

    // ======================
    // LOG
    // ======================
    logDetails.push(`ID${row.id} ${row.item}`);
  }

  return { logDetails, rows };
}

module.exports = { rejectRequests };