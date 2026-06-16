const supabase = require("../../services/db");
const { DateTime } = require("luxon");
const { toProperCase } = require("../helpers");

async function getUserDisplay(chatId) {
  const { data, error } = await supabase
    .from("users")
    .select("nickname, chat_id")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) {
    console.log("USER DISPLAY ERROR:", error);
    return { nickname: "-", chat_id: "-" };
  }

  return {
    nickname: data?.nickname || "-",
    chat_id:  data?.chat_id  || "-"
  };
}

async function checkRole(chat_id, allowed) {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("chat_id", chat_id)
    .maybeSingle();

  if (!data) return { ok: false, role: null };

  return {
    ok:   allowed.includes(data.role),
    role: data.role
  };
}

async function writeLog(chatId, role, command, details = "", tenantId = null) {
  try {
    await supabase.from("audit_logs").insert({  // ✅ fix: logs → audit_logs
      chat_id:   chatId,
      role,
      command,
      details,
      tenant_id: tenantId
    });
    await supabase.rpc("trim_logs");
  } catch (err) {
    console.log("LOG ERROR:", err);
  }
}

async function formatLogs(rows) {
  if (!rows?.length) return "📜 LOG KOSONG";

  const userIds = [...new Set(rows.map(r => r.chat_id))];
  const { data: users } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .in("chat_id", userIds);

  const nickMap = {};
  users?.forEach(u => { nickMap[u.chat_id] = u.nickname; });

  let text = "📜 LOG\n\n";

  for (const r of rows) {
    const d    = DateTime.fromISO(r.created_at).setZone("Asia/Kuala_Lumpur");
    const name = toProperCase(nickMap[r.chat_id] || r.chat_id);
    text += `${d.toFormat("d/M")} ${d.toFormat("HH:mm")}\nCMD: ${r.command}\n${r.details || "-"}\nBY: ${name} (${r.chat_id})\n\n`;
  }

  return text;
}

module.exports = { getUserDisplay, checkRole, writeLog, formatLogs };