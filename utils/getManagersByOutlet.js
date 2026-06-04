const supabase = require("../services/db");

async function getManagersByOutlet(outletId) {

  const { data, error } = await supabase
    .from("user_outlets")
    .select(`
      user_chat_id,
      users!inner(chat_id, role)
    `)
    .eq("outlet_id", outletId)
    .eq("users.role", "manager");

  if (error) {
    console.log("GETMANAGERS ERROR:", error);
    return [];
  }

  if (!data?.length) return [];

  return data.map(l => ({ chat_id: l.user_chat_id }));
}

module.exports = { getManagersByOutlet };