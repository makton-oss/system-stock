const supabase = require("../services/db");

async function getOutletIdByCode( code ) {

  const { data } =
    await supabase
      .from("outlets")
      .select("id")
      .ilike("code", code)
      .maybeSingle();

  return data?.id || null;
}

module.exports = {
  getOutletIdByCode
};