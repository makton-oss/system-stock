const supabase = require("../../services/db");

async function upsertUser({ phone, role, nickname, outletId, tenantId }) {
  const { error } = await supabase
    .from("users")
    .upsert(
      {
        chat_id:   phone,
        role,
        nickname,
        outlet_id: (role === "staff" || role === "supervisor") ? outletId : null,
        is_active: true,
        tenant_id: tenantId
      },
      { onConflict: "chat_id" }
    );

  if (error) console.log("UPSERT_USER ERROR:", error);
  return { error };
}

module.exports = { upsertUser };