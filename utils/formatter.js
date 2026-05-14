const supabase = require("../services/db");
const { DateTime } = require("luxon");

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
	const outlet = rows[0]?.outlet_name || "-";

	if (!rows || rows.length === 0) {
		return "📦 STOCK KOSONG";
	}

	let reply = `📦 STOCK\n🏪 ${toProperCase(outlet)}\n`;
	reply += `${formatLogDateTime()}\n\n`;

	rows.forEach(r => {
		reply +=
`${toProperCase(r.item_name)}
Qty: ${r.qty}
Category: ${toProperCase(r.category)}
Min Qty: ${r.min_qty}
Cost: RM${Number(r.cost_price).toFixed(2)}

		`;
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

// ======================
// PROPER CASE
// ======================
function toProperCase(str = "") {
  return str
    .toString()
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ======================
// MY TZ
// ======================
function nowMY() {
  return DateTime.now().setZone("Asia/Kuala_Lumpur");
}

// ======================
// ROLE GUIDE
// ======================
const ROLE_GUIDE = {

  staff: `
📦 STAFF GUIDE

Hai 👋
Sistem ni untuk update stok harian sahaja.

────────────────────

📥 Bila barang baru sampai:
IN ayam 10
IN ikan 5

✅ Maksud:
Tambah stok dalam sistem

────────────────────

📤 Bila barang guna / jual:
OUT ayam 2
OUT ikan 1

✅ Maksud:
Kurangkan stok dalam sistem

────────────────────

📦 Nak tengok stok semasa:
STOCK

────────────────────

📋 Nak tengok permintaan pending:
LIST

────────────────────

💡 TIPS MUDAH:
• IN = barang masuk
• OUT = barang keluar
• Ikut contoh sahaja 👍

❓ Kalau lupa command:
HELP
`,

  manager: `
📊 MANAGER GUIDE

Hai 👋
Anda boleh semak & luluskan request staf.

────────────────────

📋 Semak semua request:
LIST

────────────────────

✅ Luluskan semua request:
APPROVE ALL

✅ Luluskan satu request:
APPROVE 12

────────────────────

❌ Tolak semua request:
REJECT ALL

❌ Tolak satu request:
REJECT 12

────────────────────

📦 Semak stok semasa:
STOCK

────────────────────

📊 Laporan bulanan:
REPORT current

📊 Laporan bulan tertentu:
REPORT feb-26

────────────────────

👥 Semak staff:
STAFF

────────────────────

💡 TIPS MUDAH:
• APPROVE = setuju request
• REJECT = batalkan request
• Semak LIST dulu sebelum approve 👍

❓ Kalau lupa command:
HELP
`,

  admin: `
🛠 ADMIN GUIDE

Hai 👋
Anda mempunyai akses penuh sistem.

────────────────────

👤 Tambah / tukar role user:
SETROLE 60123456789 manager ali

────────────────────

🗑 Buang user:
REMOVEROLE 60123456789

────────────────────

👥 Semak semua staff:
STAFF

────────────────────

📜 Semak log sistem:
LOG

────────────────────

📦 Semak stok:
STOCK

────────────────────

📊 Laporan bulanan:
REPORT current

📊 Laporan bulan tertentu:
REPORT feb-26

────────────────────

➕ Tambah item baru:
ADDITEM ayam

────────────────────

🗑 Buang item:
REMOVEITEM ayam

────────────────────

💡 TIPS PENTING:
• Pastikan nombor phone betul
• Semak role sebelum SETROLE
• Manager boleh approve request staf

❓ Kalau lupa command:
HELP
`
};

// ======================
// MONTH CALCULATOR
// ======================
function parseMonthInput(input) {

  if (!input || input.toLowerCase() === "current") {

    const now = new Date();

    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    };
  }

  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11
  };

  const [m, y] = input.toLowerCase().split("-");

  const month = months[m];

  const year = 2000 + parseInt(y);

  if (month === undefined || isNaN(year)) {
    return null;
  }

  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1)
  };
}

// ======================
// ROLE CHECK
// ======================
async function checkRole(chat_id, allowed) {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("chat_id", chat_id)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      role: null
    };
  }

  return {
    ok: allowed.includes(data.role),
    role: data.role
  };
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
  formatStaff,
  toProperCase,
  nowMY,
  ROLE_GUIDE,
  parseMonthInput,
  checkRole
};
	
	