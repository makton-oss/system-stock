// ======================
// GET ROLE
// ======================
function getRoleGuide(role) {
  return ROLE_GUIDE[role] || "";
}

// ======================
// LOW STOCK ALERT
// ======================
function formatLowStockAlert(item, qty, minQty) {
  return `⚠️ LOW STOCK ALERT

ITEM: ${toProperCase(item)}
BALANCE: ${qty}
MINIMUM: ${minQty}`;
}

// ======================
// WRITE LOG
// ======================
async function writeLog(chatId, role, command, details = "") {
  try {
    await supabase.from("logs").insert({
      chat_id: chatId,
      role,
      command,
      details
    });

    // keep last 50 logs
    const { data } = await supabase
      .from("logs")
      .select("id")
      .order("id", { ascending: false });

    if (data && data.length > 50) {
      const idsToDelete = data.slice(50).map(x => x.id);

      await supabase
        .from("logs")
        .delete()
        .in("id", idsToDelete);
    }

  } catch (err) {
    console.log("LOG ERROR:", err);
  }
}

// ======================
// GET USER DISPLAY NAME
// ======================
async function getUserDisplay(chatId) {
  const { data } = await supabase
    .from("users")
    .select("nickname, chat_id")
    .eq("chat_id", chatId)
    .single();

  if (!data) {
    return {
      nickname: "-",
      chat_id: "-"
    };
  }

  return {
    nickname: data.nickname || "-",
    chat_id: data.chat_id
  };
}

// ======================
// DATE & TIME
// ======================
function formatLogDateTime(date = null) {

  const d = date
    ? DateTime.fromJSDate(new Date(date))
        .setZone("Asia/Kuala_Lumpur")
    : nowMY();

  return d.toFormat("d/M HH:mm");
}

// ======================
// STOCK FORMAT
// ======================
function formatStock(rows) {

  if (!rows || rows.length === 0) {
    return "📦 STOCK KOSONG";
  }

  let reply = `📦 STOCK\n`;
  reply += `${formatLogDateTime()}\n\n`;

  rows.forEach(r => {
    reply += `${toProperCase(r.item)} : ${r.qty}\n`;
  });

  return reply;
}

// ======================
// PENDING FORMAT
// ======================
function formatPending(rows) {

  if (!rows || rows.length === 0) {
    return "📭 TIADA REQUEST";
  }

  let reply = `📋 PENDING LIST\n\n`;

  rows.forEach(r => {

    reply +=
`ID ${r.id}
TYPE : ${r.type?.toUpperCase()}
ITEM : ${toProperCase(r.item)}
QTY  : ${r.qty}

`;

  });

  return reply;
}

// ======================
// LOG FORMAT
// ======================
async function formatLogs(rows) {

  if (!rows?.length) return "📜 LOG KOSONG";

  const userIds = [...new Set(rows.map(r => r.chat_id))];

  const { data: users } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .in("chat_id", userIds);

  const map = {};
  users?.forEach(u => {
    map[u.chat_id] = u.nickname;
  });

  let reply = "📜 LOG\n\n";

  for (const r of rows) {

    const d = DateTime
	  .fromISO(r.created_at)
	  .setZone("Asia/Kuala_Lumpur");

	const date = d.toFormat("d/M");
	const time = d.toFormat("HH:mm");

    const name = toProperCase(map[r.chat_id] || r.chat_id);

    reply += `${date} ${time}
CMD: ${r.command}
${r.details || "-"}
BY: ${name} (${r.chat_id})

`;
  }

  return reply;
}

// ======================
// STAFF FORMAT
// ======================
function formatStaff(rows) {

  if (!rows || rows.length === 0) {
    return "👥 STAFF KOSONG";
  }

  let reply = "👥 STAFF LIST\n\n";

  rows.forEach(r => {

    let name = r.nickname || "-";
    let id = r.chat_id;
    let role = r.role?.toUpperCase();

    reply +=
`👤 ${toProperCase(name)}
📱 ${id}
🏷️ ${role}

`;
  });
  
  return reply;
}


module.exports = {
  getRoleGuide,
  formatLowStockAlert,
  writeLog,
  getUserDisplay,
  formatLogDateTime,
  formatStock,
  formatPending,
  formatLogs,
  formatStaff
};
	
	