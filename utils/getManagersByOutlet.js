const supabase = require("../services/db");

async function getManagersByOutlet(outletId) {

  const { data: links, error } = await supabase
    .from("user_outlets")
    .select("user_chat_id")
    .eq("outlet_id", outletId);

  if (error) {
    console.log("LINK ERROR:", error);
    return [];
  }

  if (!links?.length) return [];

  // terus return format sama macam users table
  return links.map(l => ({
    chat_id: l.user_chat_id
  }));
}

module.exports = { getManagersByOutlet };