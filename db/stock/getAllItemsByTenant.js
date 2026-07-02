const supabase = require("../../services/db");

// Master items list (table: items) — cross-outlet, used for
// item-name combobox so admin can reuse existing item names
// instead of accidentally creating a near-duplicate (e.g. "ayam rempah"
// vs "ayam  rempah") when adding the same item to another outlet.
async function getAllItemsByTenant(tenantId) {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, category")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) console.log("GET_ALL_ITEMS_BY_TENANT ERROR:", error);
  return data || [];
}

module.exports = { getAllItemsByTenant };