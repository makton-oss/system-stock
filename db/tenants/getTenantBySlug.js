const supabase = require("../../services/db");

async function getTenantBySlug(slug) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = { getTenantBySlug };