const supabase = require("../../services/db");

async function getAllTenants() {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, brand")
    .eq("is_active", true)
    .order("slug", { ascending: true });

  if (error) console.log("GET_ALL_TENANTS ERROR:", error);
  return data || [];
}

module.exports = { getAllTenants };