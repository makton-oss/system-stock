const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { formatStaffList, formatStaffListAdmin } = require("../utils/formatter");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, user, reply, res } = ctx;

  // ======================
  // 🔥 ADMIN → ALL OUTLETS (UNCHANGED)
  // ======================
  if (user.role === "admin") {

    const { data, error } = await supabase
      .from("users")
      .select(`
        chat_id,
        nickname,
        role,
        outlet_id,
        outlets(name)
      `)
      .neq("role", "admin")
      .order("outlet_id", { ascending: true });

    if (error) {
      console.log("STAFF ERROR:", error);
      await reply(chatId, "❌ ERROR");
      return res.end();
    }

    await reply(chatId, formatStaffListAdmin(data));
    return res.end();
  }

  // ======================
  // 🔥 MANAGER → MULTI OUTLET SUPPORT
  // ======================
  const outletIds = await getAccessibleOutletIds(user);

  // 🔥 IMPORTANT: include manager + staff (exclude admin only)
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
    .neq("role", "admin");

  if (error) {
    console.log("STAFF ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  // ======================
  // 🔥 SINGLE vs MULTI OUTLET
  // ======================
  const uniqueOutletIds = [...new Set(data.map(r => r.outlet_id))];

  if (uniqueOutletIds.length > 1) {
    // MULTI → same format macam ADMIN
    await reply(chatId, formatStaffListAdmin(data));
  } else {
    // SINGLE → simple format
    await reply(chatId, formatStaffList(data));
  }

  return res.end();
});