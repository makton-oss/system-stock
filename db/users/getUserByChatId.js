const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

async function getUserByChatId(chatId, tenantId = null) {
  let q = supabase
    .from("users")
    .select("*, outlets(name)")
    .eq("chat_id", chatId)
    .eq("is_active", true);

  q = applyTenant(q, tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) console.log("GET_USER ERROR:", error);
  return data || null;
}

module.exports = { getUserByChatId };