const supabase = require("../services/db");

async function getAccessibleOutletIds(user) {

  // ======================
  // MANAGER = MULTI OUTLET
  // ======================

  if (user.role === "manager") {

    const { data: links, error } = await supabase
      .from("outlet_access")
      .select("outlet_id")
      .eq("user_chat_id", user.chat_id);

    if (error || !links?.length) {
      return [];
    }

    return links.map(x => x.outlet_id);
  }

  // ======================
  // SUPERVISOR = SINGLE
  // ======================

  if (user.role === "supervisor") {

    if (!user.outlet_id) return [];

    return [user.outlet_id];
  }

  // ======================
  // STAFF
  // ======================

  if (user.role === "staff") {

    if (!user.outlet_id) return [];

    return [user.outlet_id];
  }

  return [];
}

module.exports = { getAccessibleOutletIds };