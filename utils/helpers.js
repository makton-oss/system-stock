const supabase = require("../services/db");

// ======================
// RESPONSE
// ======================

function end(res) {
  return res.status(200).end();
}

// ======================
// DB ERROR
// ======================

async function handleDbError(error, chatId, reply) {

  if (!error) return false;

  console.log("DB ERROR:", error);

  await reply(chatId, "❌ DATABASE ERROR");

  return true;
}

// ======================
// ACCESS DENY
// ======================

async function deny(chatId, reply, text = "❌ NO ACCESS") {
  await reply(chatId, text);
  return true;
}

// ======================
// ITEM NORMALIZER
// ======================

function normalizeItem(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

// ======================
// SAFE INTEGER
// ======================

function safeQty(value) {

  const qty = parseInt(value);

  if (isNaN(qty) || qty <= 0) {
    return null;
  }

  return qty;
}

// ======================
// LOW STOCK CHECKER
// ======================
function isLowStock(qty, minQty) {
  return qty <= minQty;
}

// ======================
// MY TZ
// ======================
function nowMY() {
  return DateTime.now().setZone("Asia/Kuala_Lumpur");
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
APPROVE

✅ Luluskan satu request:
APPROVE 12

────────────────────

❌ Tolak semua request:
REJECT

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
  end,
  handleDbError,
  deny,
  normalizeItem,
  safeQty,
  isLowStock,
  nowMY,
  toProperCase,
  ROLE_GUIDE,
  parseMonthInput,
  checkRole
};