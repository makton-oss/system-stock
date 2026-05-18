const supabase = require("../services/db");

async function getManagersByOutlet(outletId) {

  // 1. get managers from user_outlets
  const { data: links, error: linkError } = await supabase
    .from("user_outlets")
    .select("user_id")
    .eq("outlet_id", outletId);

  if (linkError) {
    console.log("LINK ERROR:", linkError);
    return [];
  }

  if (!links.length) return [];

  const userIds = links.map(l => l.user_id);

  // 2. get actual users
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .in("id", userIds)
    .eq("role", "manager");

  if (userError) {
    console.log("USER ERROR:", userError);
    return [];
  }

  return users;
}

module.exports = { getManagersByOutlet };