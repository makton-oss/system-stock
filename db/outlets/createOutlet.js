const supabase = require("../../services/db");

async function createOutlet({ name, tenantId }) {

  const { data, error } = await supabase
    .from("outlets")
    .insert({
      name:      name.toLowerCase().trim(),
      tenant_id: tenantId
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "OUTLET_EXISTS" };
    return { error: "DB_ERROR" };
  }

  return { ok: true, outlet: data };
}

module.exports = { createOutlet };