const supabase = require("../services/db");

async function getAccessibleOutletIds(user) {

  // ======================
  // ADMIN → ALL OUTLETS
  // ======================
  if (user.role === "admin") {
    const { data, error } = await supabase
      .from("outlets")
      .select("id");

    if (error) {
      console.log("OUTLET FETCH ERROR:", error);
      return [];
    }

    return data.map(o => o.id);
  }

  // ======================
  // MANAGER → MULTI OUTLET (pivot)
  // ======================
  if (user.role === "manager") {

    const { data, error } = await supabase
      .from("user_outlets")
      .select("outlet_id")
      .eq("user_chat_id", user.chat_id);

    if (error) {
      console.log("USER_OUTLETS ERROR:", error);
      return [];
    }

    // kalau ada assign
    if (data?.length) {
      return data.map(r => r.outlet_id);
    }
  }

  // ======================
  // STAFF / FALLBACK
  // ======================
  return [user.outlet_id];
}

module.exports = { getAccessibleOutletIds };