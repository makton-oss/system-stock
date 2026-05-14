const supabase = require("./db");

async function rejectRequests(rows, chatId) {

  const ids = rows.map(r => r.id);
  const outletId = rows[0]?.outlet_id;

  const { error } = await supabase
    .from("requests")
    .update({
      status: "rejected",
      processed_by: chatId,
      processed_at: new Date().toISOString()
    })
    .in("id", ids)
    .eq("outlet_id", outletId)
    .eq("status", "processing");

  if (error) return { error };

  return { success: true, count: rows.length };
}

module.exports = { rejectRequests };