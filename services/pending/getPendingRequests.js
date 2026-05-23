const supabase = require("../db");

async function getPendingRequests({ user, outletIds}) {

  let query =
    supabase
      .from("requests")
      .select(`
        id,
        type,
        item,
        qty,
        created_at,
        requested_by,
        outlet_id,
        outlets(name),
        users(nickname, chat_id)
      `)
      .eq("status", "pending")
      .order("created_at", {
        ascending: true
      });

  // ======================
  // ADMIN
  // ======================

  if (
    user.role !== "admin"
  ) {

    query =
      query.in(
        "outlet_id",
        outletIds
      );
  }

  return await query;
}

module.exports = {
  getPendingRequests
};