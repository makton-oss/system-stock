const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatStaffList, formatStaffListAdmin } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

  // ======================
  // 🔥 ADMIN → ALL OUTLETS
  // ======================
  if (user.role === "admin") {

    const { data, error } = await supabase
      .from("users")
      .select(`
        chat_id,
        nickname,
        role,
        outlet_id,
        outlets(name),
        user_outlets(
          outlet_id,
          outlets(name)
        )
      `)
      .neq("role", "admin")
      .eq("is_active", true);        // ← tambah ini

    if (error) {
      console.log("STAFF ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    // normalize data
    let normalized = [];

    for (let u of data) {

      if (u.role === "staff" || u.role === "supervisor") {
        normalized.push({
          ...u,
          outlets: u.outlets
        });
        continue;
      }

      if (u.role === "manager") {

        if (!u.user_outlets?.length) {
          normalized.push({
            ...u,
            outlets: { name: "-" }
          });
          continue;
        }

        for (let rel of u.user_outlets) {
          normalized.push({
            ...u,
            outlet_id: rel.outlet_id,
            outlets: rel.outlets
          });
        }
      }
    }

    await reply(chatId, formatStaffListAdmin(normalized));
    return res.end();
  }

  // ======================
  // 🔥 MANAGER → MULTI OUTLET
  // ======================
  const outletIds = await getAccessibleOutletIds(user);

  const { data, error } = await supabase
    .from("users")
    .select(`
      chat_id,
      nickname,
      role,
      outlet_id,
      outlets(name)
    `)
    .in("outlet_id", outletIds)
    .neq("role", "admin")
    .eq("is_active", true);          // ← tambah ini

  if (error) {
    console.log("STAFF ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  const uniqueOutletIds = [...new Set(data.map(r => r.outlet_id))];

  if (uniqueOutletIds.length > 1) {
    await reply(chatId, formatStaffListAdmin(data));
  } else {
    await reply(chatId, formatStaffList(data));
  }

  return res.end();
});