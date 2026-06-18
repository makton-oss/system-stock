const supabase = require("../../services/db");

const PLAN_CONFIG = {
  basic:    { max_users: 5,  can_report: false },
  starter:  { max_users: 5,  can_report: true  },
  business: { max_users: 20, can_report: true  },
  custom:   { max_users: 50, can_report: true  }
};

async function createTenant({ name, slug, plan, brand, hasMaintenance }) {

  const config = PLAN_CONFIG[plan];

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name,
      slug,
      plan,
      brand,
      max_users:  config.max_users,
      can_report: config.can_report,
      has_backup: hasMaintenance,
      is_active:  true
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "SLUG_TAKEN" };
    console.log("CREATE_TENANT ERROR:", error);
    return { error: "DB_ERROR" };
  }

  return { ok: true, tenant: data };
}

module.exports = { createTenant, PLAN_CONFIG };