const supabase = require("../../services/db");

async function createOutlet({ name, tenantId }) {

  const { data, error } = await supabase
    .from("outlets")
    .insert({
      name,
      tenant_id: tenantId
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "OUTLET_EXISTS" };
    console.log("CREATE_OUTLET ERROR:", error);
    return { error: "DB_ERROR" };
  }

  return { ok: true, outlet: data };
}

module.exports = { createOutlet };