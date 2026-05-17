const supabase = require("../services/db");
const { DateTime } = require("luxon");

function pc(s) {
  return s?.charAt(0).toUpperCase() + s?.slice(1).toLowerCase();
}
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
  const { data, error } = await supabase
    .from("users")
    .select("nickname, chat_id")
    .eq("chat_id", chatId)
    .maybeSingle();
	
  if (error) {
	  console.log("USER DISPLAY ERROR:", error);
	  return { nickname: "-", chat_id: "-" };
	}

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
// ITEM FORMAT
// ======================
function formatItemList(rows) {

  if (!rows?.length) return "📦 ITEM KOSONG";

  let reply = "📦 ITEM CONFIG\n\n";

  rows.forEach(r => {

    const name = toProperCase(r.stock_items?.name || r.item || "-" );
    const uom = r.stock_items?.uom || "-";
    const cost = Number(r.stock_items?.cost_price || 0);
    const minqty = r.min_qty ?? || "-";

    reply += `${name}
UOM: ${uom}
Cost: RM${cost.toFixed(2)}
Min Qty: ${toProperCase(minqty)}

`;
  });

  return reply;
}

// ======================
// ITEM FORMAT ADMIN
// ======================
function formatItemListAdmin(rows) {

  if (!rows?.length) return "📦 ITEM KOSONG";

  const map = {};

  rows.forEach(r => {

    const outlet = r.outlets?.name || "-";

    if (!map[outlet]) {
      map[outlet] = [];
    }

    map[outlet].push(r);
  });

  let reply = "📦 ITEM CONFIG\n\n";

  Object.entries(map).forEach(([outlet, items]) => {

    reply += `${toProperCase(outlet)}\n\n`;

    items.forEach(r => {

      const name = toProperCase(
        r.stock_items?.name || r.item || "-"
      );

      const uom = r.stock_items?.uom || "-";
      const cost = Number(r.stock_items?.cost_price || 0);
      const minqty = r.min_qty ?? "-";

      reply += `${name}
UOM: ${uom}
Cost: RM${cost.toFixed(2)}
Min Qty: ${minqty}

`;
    });

    reply += "\n";
  });

  return reply;
}

// ======================
// STOCK FORMAT
// ======================
function formatStockAdmin(rows) {

  if (!rows?.length) return "📦 STOCK KOSONG";

  const map = {};

  rows.forEach(r => {

    const outlet = r.outlets?.name || "-";

    if (!map[outlet]) map[outlet] = [];

    map[outlet].push(r);
  });

  let reply = "📦 STOCK\n";

  Object.entries(map).forEach(([outlet, items]) => {

    reply += `🏪 ${toProperCase(outlet)}\n`;
    reply += `${formatLogDateTime()}\n`;

    items.forEach((r, i) => {

      const item = r.stock_items?.name || r.item || "-";
      const uom = r.stock_items?.uom || "UOM";

      reply += `${i + 1}. ${toProperCase(item)} x ${r.qty} (${uom})\n`;
    });

    reply += "\n\n";
  });

  return reply;
}

// ======================
// STOCK FORMAT ADMIN
// ======================
function formatStock(rows) {

  if (!rows || rows.length === 0) {
    return "📦 STOCK KOSONG";
  }

  const outlet = rows[0]?.outlets?.name || "-";

  let reply = `📦 STOCK\n🏪 ${toProperCase(outlet)}\n`;
  reply += `${formatLogDateTime()}\n`;

  rows.forEach((r, i) => {

    const item = r.stock_items?.name || r.item || "-";

    // kalau ada UOM nanti boleh tukar sini
    const uom = r.stock_items?.uom || "UOM";

    reply += `${i + 1}. ${toProperCase(item)} x ${r.qty} (${uom})\n`;
  });

  return reply;
}

// ======================
// PENDING FORMAT
// ======================
function formatPending(rows) {

  if (!rows?.length) return "📭 TIADA REQUEST";

  const outlet = rows[0]?.outlets?.name || "-";

  let reply = `📋 PENDING LIST\n${toProperCase(outlet)}\n\n`;

  rows.forEach(r => {

    const date = DateTime
      .fromISO(r.created_at)
      .setZone("Asia/Kuala_Lumpur")
      .toFormat("d/M | HH:mm");

    const userName = r.users?.nickname || "-";
    const chatId = r.users?.chat_id || "-";

    reply += `ID ${r.id} | ${date}
${r.type?.toUpperCase()} ${toProperCase(r.item)} x ${r.qty}
BY: ${toProperCase(userName)} (${chatId})

`;
  });

  return reply;
}

// ======================
// PENDING FORMAT ADMIN
// ======================
function formatPendingAdmin(rows) {

  if (!rows?.length) return "📭 TIADA REQUEST";

  const map = {};

  rows.forEach(r => {
    const outlet = r.outlets?.name || "-";
    if (!map[outlet]) map[outlet] = [];
    map[outlet].push(r);
  });

  let reply = "📋 PENDING LIST\n\n";

  Object.entries(map).forEach(([outlet, list]) => {

    reply += `${toProperCase(outlet)}\n\n`;

    list.forEach(r => {

      const date = DateTime
        .fromISO(r.created_at)
        .setZone("Asia/Kuala_Lumpur")
        .toFormat("d/M | HH:mm");

      const userName = r.users?.nickname || "-";
      const chatId = r.users?.chat_id || "-";

      reply += `ID ${r.id} | ${date}
${r.type?.toUpperCase()} ${toProperCase(r.item)} x ${r.qty}
BY: ${toProperCase(userName)} (${chatId})

`;
    });

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
function formatStaffList(rows) {

  if (!rows?.length) return "👥 STAFF KOSONG";

  const outlet = rows[0]?.outlets?.name || "-";

  const managers = rows.filter(r => r.role === "manager");
  const staff = rows.filter(r => r.role === "staff");

  let reply = `👥 STAFF LIST\n${toProperCase(outlet)}\n\n`;

  if (managers.length) {
    reply += "Manager\n";
    managers.forEach((u, i) => {
      reply += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
    });
    reply += "\n";
  }

  if (staff.length) {
    reply += "Staff\n";
    staff.forEach((u, i) => {
      reply += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
    });
  }

  return reply;
}

// ======================
// STAFF FORMAT ADMIN
// ======================
function formatStaffListAdmin(rows) {

  if (!rows?.length) return "👥 STAFF KOSONG";

  const map = {};

  rows.forEach(r => {

    const outlet = r.outlets?.name || "-";

    if (!map[outlet]) {
      map[outlet] = {
        manager: [],
        staff: []
      };
    }

    if (r.role === "manager") {
      map[outlet].manager.push(r);
    } else if (r.role === "staff") {
      map[outlet].staff.push(r);
    }
  });

  let reply = "👥 STAFF LIST\n\n";

  Object.entries(map).forEach(([outlet, group]) => {

    reply += `${toProperCase(outlet)}\n\n`;

    if (group.manager.length) {
      reply += "Manager\n";
      group.manager.forEach((u, i) => {
        reply += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
      });
      reply += "\n";
    }

    if (group.staff.length) {
      reply += "Staff\n";
      group.staff.forEach((u, i) => {
        reply += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
      });
    }

    reply += "\n";
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

// ======================
// FORMAT MAIN REPORT
// ======================
function formatMainReport(data, monthLabel) {

  let text = `📊 STOCK REPORT - ${monthLabel}\n`;

  Object.entries(data).forEach(([outlet, o]) => {

    text += `OUTLET ${outlet}\n\n`;

    text += `💰 TOTAL COST RM ${o.totalCost.toFixed(0)}\n\n`;

    text += "📉 TOP 5 COST ITEM\n";

    const items = Object.entries(o.itemMap)
      .sort((a,b) => b[1] - a[1]);

    const top = items.slice(0,5);

    top.forEach(([n,v]) => {
      text += `${n}: RM${v.toFixed(0)}\n`;
    });

    text += "\n📦 CATEGORY COST\n";

    Object.entries(o.categoryMap).forEach(([c,v]) => {
      text += `${c}: RM${v.toFixed(0)}\n`;
    });

    text += `\n💸 FLOW (VALUE)\n`;
    text += `IN   : RM ${o.flowIn.toFixed(0)}\n`;
    text += `OUT  : RM ${o.flowOut.toFixed(0)}\n`;
    text += `NET  : RM ${(o.flowIn - o.flowOut).toFixed(0)}\n\n`;
  });

  return text;
}

// ======================
// INVENTORY FORMAT
// ======================
function formatInventoryReport(data, month) {

  let text = `📦 INVENTORY VALUE REPORT (${month})\n`;

  Object.entries(data).forEach(([outlet, rows]) => {

    let total = 0;

    text += `OUTLET ${outlet}\n\n`;

    rows.forEach(r => {
      const val = r.qty * r.stock_items.cost_price;
      total += val;

      text += `${pc(r.stock_items.name)} x ${r.qty} = RM${val.toFixed(2)}\n`;
    });

    text += `\nTOTAL RM${total.toFixed(2)}\n\n`;
  });

  return text;
}

// ======================
// DETAIL FORMAT
// ======================
function formatDetailReport(data, month) {

  let text = `📊 DETAIL INOUT REPORT (${month})\n`;

  Object.entries(data).forEach(([outlet, rows]) => {

    text += `OUTLET ${outlet}\n\n`;

    rows.forEach(r => {
      text += `${pc(r.name)}\nIN: ${r.in} OUT: ${r.out} BAL:${r.bal}\n\n`;
    });
  });

  return text;
}

// ======================
// DEAD FORMAT
// ======================
function formatDeadReport(data, month) {

  let text = `💀 DEAD STOCK (${month})\n`;

  Object.entries(data).forEach(([outlet, rows]) => {

    text += `OUTLET ${outlet}\n\n`;

    rows.forEach((r,i) => {
      text += `${i+1}. ${pc(r.name)} (${r.last})\n`;
    });

    text += "\n";
  });

  return text;
}

// ======================
// FLOW FORMAT
// ======================
function formatFlowReport(data, month) {

  let text = `💸 FLOW (Value) REPORT (${month})\n`;

  Object.entries(data).forEach(([outlet, r]) => {

    text += `OUTLET ${outlet}\n\n`;

    text += `IN   RM ${r.inVal}\nOUT  RM ${r.outVal}\nNET  RM ${r.net}\n\n`;

    text += "Top 5 IN STOCK\n";
    r.topIn.forEach((t,i)=>{
      text += `${i+1}. ${pc(t[0])} RM${t[1]}\n`;
    });

    text += "\nTop 5 OUT STOCK\n";
    r.topOut.forEach((t,i)=>{
      text += `${i+1}. ${pc(t[0])} RM${t[1]}\n`;
    });

    text += "\n";
  });

  return text;
}

module.exports = {
  
};

module.exports = {
  getRoleGuide,
  formatLowStockAlert,
  writeLog,
  getUserDisplay,
  formatLogDateTime,
  formatItemList,
  formatItemListAdmin,
  formatStock,
  formatStockAdmin,
  formatPending,
  formatPendingAdmin,
  formatLogs,
  formatStaffList,
  formatStaffListAdmin,
  toProperCase,
  nowMY,
  ROLE_GUIDE,
  parseMonthInput,
  checkRole,
  formatMainReport,
  formatInventoryReport,
  formatDetailReport,
  formatDeadReport,
  formatFlowReport
};
	
	