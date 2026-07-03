const supabase = require("../../services/db");

async function getUserOutletIds(phone) {
  const { data, error } = await supabase
    .from("outlet_access")           // ✅ betul
    .select("outlet_id")
    .eq("user_chat_id", phone);

  if (error) console.log("GET_USER_OUTLET_IDS ERROR:", error);
  return data?.map(r => r.outlet_id) || [];
}

async function insertUserOutlets(phone, outletIds) {
  const rows = outletIds.map(id => ({ user_chat_id: phone, outlet_id: id }));
  const { error } = await supabase.from("outlet_access").insert(rows); // ✅
  if (error) console.log("INSERT_USER_OUTLETS ERROR:", error);
  return { error };
}

async function clearUserOutlets(phone) {
  const { error } = await supabase
    .from("outlet_access")           // ✅ betul
    .delete()
    .eq("user_chat_id", phone);

  if (error) console.log("CLEAR_USER_OUTLETS ERROR:", error);
  return { error };
}

// Dropdown source — Remove Outlet Access, scoped ke outlet yang user TU je ada
// (beza dari getUserOutletIds — ni return nama outlet sekali utk display, bukan raw IDs je)
async function getUserOutletsDetailed(phone) {
  const { data, error } = await supabase
    .from("outlet_access")
    .select("outlet_id, outlets(name)")
    .eq("user_chat_id", phone);

  if (error) console.log("GET_USER_OUTLETS_DETAILED ERROR:", error);
  return data || [];
}

module.exports = { getUserOutletIds, insertUserOutlets, clearUserOutlets, getUserOutletsDetailed };