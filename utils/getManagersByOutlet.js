const supabase = require("../services/db");

async function getManagersByOutlet(outletId) {

  const { data, error } = await supabase
    .from("users")
    .select("chat_id")
    .eq("role", "manager")
    .eq("outlet_id", outletId);

  if (error) {
    console.log("GET MANAGER ERROR:", error);
    return [];
  }

  return data.map(u => u.chat_id);
}

module.exports = { getManagersByOutlet };