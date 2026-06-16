const supabase = require("../../services/db");

async function setUserActive(phone, isActive) {
  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("chat_id", phone);

  if (error) console.log("SET_USER_ACTIVE ERROR:", error);
  return { error };
}

module.exports = { setUserActive };