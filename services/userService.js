const supabase = require("./db");

async function getManagers(outletId) {
  const { data } = await supabase
    .from("users")
    .select("chat_id")
    .eq("role", "manager")
    .eq("outlet_id", outletId);

  return data || [];
}

module.exports = { getManagers };