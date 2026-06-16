const supabase = require("../../services/db");

async function removeUserOutletLink(phone, outletId) {
  // Check berapa outlet user ada dulu
  const { data: existing, error: fetchError } = await supabase
    .from("outlet_access")           // ✅ betul — bukan user_outlets
    .select("outlet_id")
    .eq("user_chat_id", phone);

  if (fetchError) {
    console.log("REMOVE_USER_OUTLET_LINK FETCH ERROR:", fetchError);
    return { error: fetchError };
  }

  if (!existing || existing.length <= 1) {
    return { error: { message: "USER MESTI ADA MINIMUM 1 OUTLET" } };
  }

  const { error } = await supabase
    .from("outlet_access")
    .delete()
    .eq("user_chat_id", phone)
    .eq("outlet_id", outletId);

  if (error) console.log("REMOVE_USER_OUTLET_LINK ERROR:", error);
  return { error };
}

module.exports = { removeUserOutletLink };