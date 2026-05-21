const supabase = require("../db");

// ======================
// GET PENDING BY OUTLET
// ======================

async function getPendingRequestsByOutlet(
  outletId
) {

  const { data, error } = await supabase
    .from("requests")
    .select(`
      *,
      outlets(name),
      users(nickname, chat_id)
    `)
    .eq("status", "pending")
    .eq("outlet_id", outletId)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    throw error;
  }

  return data || [];
}

// ======================
// GET PENDING BY ID
// ======================

async function getPendingRequestById(id) {

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// ======================
// GET PENDING BY OUTLETS
// ======================

async function getPendingRequestsByOutlets(
  outletIds
) {

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .in("outlet_id", outletIds);

  if (error) {
    throw error;
  }

  return data || [];
}

module.exports = {
  getPendingRequestsByOutlet,
  getPendingRequestById,
  getPendingRequestsByOutlets
};