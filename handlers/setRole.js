const { withRole } = require("../core/withRole");
const supabase = require("../services/db");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  if (parts.length < 5) {
    await reply(chatId, "❌ FORMAT: SETROLE phone role nickname outlet1,outlet2");
    return res.end();
  }

  const phone = parts[1];
  const role = parts[2];
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
  if (role === "staff" && outletIds.length > 1) {
    await reply(chatId, "❌ STAFF hanya boleh 1 outlet");
    return res.end();
  }

  // ======================
  // UPSERT USER
  // ======================
  await supabase.from("users").upsert({
    chat_id: phone,
    role,
    nickname,
    outlet_id: outletIds[0] // fallback utk legacy
  });

  // ======================
  // UPDATE PIVOT (manager sahaja)
  // ======================
  await supabase
    .from("user_outlets")
    .delete()
    .eq("user_chat_id", phone);

  if (role === "manager") {
    const rows = outletIds.map(id => ({
      user_chat_id: phone,
      outlet_id: id
    }));

    await supabase.from("user_outlets").insert(rows);
  }

  await reply(chatId, `✅ ${nickname} set sebagai ${role}`);
  return res.end();
});