const supabase = require("../../services/db");
const { applyTenant } = require("../../utils/applyTenant");

// Note: Sengaja tak filter is_active — nak verify user wujud walaupun inactive
async function verifyUserInTenant(phone, tenantId = null) {
  let q = supabase
    .from("users")
    .select("chat_id")
    .eq("chat_id", phone);

  q = applyTenant(q, tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) console.log("VERIFY_USER_IN_TENANT ERROR:", error);
  return data || null;
}

module.exports = { verifyUserInTenant };