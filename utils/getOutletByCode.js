const supabase = require("../services/db");

async function getOutletByCode(code) {

  const { data } =
    await supabase
      .from("outlets")
      .select("id, name")
      .ilike("name", code)
      .maybeSingle();

  return data || null;
}

module.exports = {
  getOutletByCode
};