const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { getRoleGuide } = require("../utils/formatter");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  if (parts.length < 5) {
    await reply(chatId, "❌ FORMAT: SETROLE phone role nickname outlet1,outlet2");
    return res.end();
  }

  const phone = parts[1].replace(/[^\d]/g, "");
  const role = parts[2].toLowerCase();
  const nickname = parts[3];
  const outletNames = parts.slice(4).join(" ").split(",");

  // ======================
  // GET OUTLETS
  // ======================
  const { data: outlets, error } = await supabase
    .from("outlets")
    .select("id, name");

  if (error) {
    await reply(chatId, "❌ ERROR OUTLET");
    return res.end();
  }

  const matched = outletNames.map(name =>
    outlets.find(o =>
      o.name.toLowerCase() === name.trim().toLowerCase()
    )
  );

  if (matched.some(m => !m)) {
    await reply(chatId, "❌ ADA OUTLET TAK WUJUD");
    return res.end();
  }

  const outletIds = matched.map(m => m.id);

  // ======================
  // VALIDATION
  // ======================
  if ((role === "staff" || role === "supervisor") && outletIds.length > 1) {
    await reply(chatId, "❌ STAFF dan SUPERVISOR hanya boleh 1 outlet");
    return res.end();
  }

  // ======================
  // UPSERT USER
  // ======================
  const upsertResult = await supabase
  .from("users")
  .upsert(
    {
      chat_id: phone,
      role,
      nickname,
      outlet_id: (role === "staff" || role === "supervisor") ? outletIds[0] : null,
      is_active: true
    },
    { onConflict: "chat_id" }
  );

  const upsertError = upsertResult.error;


  if (upsertError) {
    console.log("UPSERT ERROR:", upsertError);
    await reply(chatId, "❌ ERROR SET ROLE");
    return res.end();
  }

  // ======================
  // UPDATE PIVOT (manager sahaja)
  // ======================
  if (role === "manager") {

    // get existing outlets
    const { data: existing } = await supabase
      .from("user_outlets")
      .select("outlet_id")
      .eq("user_chat_id", phone);

    const existingIds = existing?.map(r => r.outlet_id) || [];

    // insert only new outlets (skip duplicates)
    const newIds = outletIds.filter(id => !existingIds.includes(id));

    if (newIds.length) {
      const rows = newIds.map(id => ({
        user_chat_id: phone,
        outlet_id: id
      }));

      await supabase.from("user_outlets").insert(rows);
    }

  } else {
    // staff / supervisor — wipe pivot (single outlet je)
    await supabase
      .from("user_outlets")
      .delete()
      .eq("user_chat_id", phone);
  }

  // ======================
  // NOTIFY
  // ======================
  await reply(chatId, `✅ ${nickname} set sebagai ${role}`);

  const guide = getRoleGuide(role);

  if (guide) {
    await reply(phone, guide);
  }

  return res.end();
});