const express = require("express");
const { DateTime } = require("luxon");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// MIDDLEWARE
// ======================
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

// ======================
// DATABASE
// ======================
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: {
      transport: WebSocket
    }
  }
);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ENV MISSING");
  process.exit(1);
}

// ======================
// HELPER
// ======================
function nowMY() {
  return DateTime.now().setZone("Asia/Kuala_Lumpur");
}

function toProperCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
// FORMATTER
// ======================
function getRoleGuide(role) {
  return ROLE_GUIDE[role] || "";
}

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

function formatLogDateTime(date = null) {

  const d = date
    ? DateTime.fromJSDate(new Date(date))
        .setZone("Asia/Kuala_Lumpur")
    : nowMY();

  return d.toFormat("d/M HH:mm");
}

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
// ROLE CHECK
// ======================
async function checkRole(chat_id, allowed) {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("chat_id", chat_id)
    .single();

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
// WHATSAPP SENDER
// ======================
async function sendWhatsApp(phoneNumber, text) {
  try {
    const response = await fetch(process.env.BOTCOMMERCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiToken: process.env.BOTCOMMERCE_API,
        phone_number_id: process.env.PHONE_NUMBER_ID,
        phone_number: phoneNumber,
        message: text
      })
    });
	
	if (!response.ok) {
	  const errText = await response.text();
	  console.log("BOTCOMMERCE ERROR:", errText);
	}
  } catch (err) {
    console.log("SEND FAIL:", err);
  }
}

async function notifyManagers(text, excludeChatId = null) {

  const { data: rows } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .eq("role", "manager");

  if (!rows || rows.length === 0) return;

  for (const u of rows) {

    if (excludeChatId && u.chat_id === excludeChatId) continue;

    const display = u.nickname || u.chat_id;

    await sendWhatsApp(
      u.chat_id,
      `${text}\n\n👤 ${display}`
    );
  }
}

async function reply(chatId, text) {
  try {
    await sendWhatsApp(chatId, text);
  } catch (err) {
    console.error("REPLY ERROR:", err);
  }
}

// ======================
// MONTHLY REPORT
// ======================
async function generateMonthlyReport(monthInput) {

  const range = parseMonthInput(monthInput);

  if (!range) {
    return "❌ FORMAT: REPORT feb-26";
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();

  // ======================
  // FETCH ALL ANALYTICS
  // ======================

  const [
    inventory,
    fast,
    slow,
    dead,
    trend
  ] = await Promise.all([

    supabase.rpc(
      "get_inventory_value_by_date",
      {
        p_start: start,
        p_end: end
      }
    ),

    supabase.rpc(
      "get_fast_moving_by_date",
      {
        p_start: start,
        p_end: end
      }
    ),

    supabase.rpc(
      "get_slow_moving_by_date",
      {
        p_start: start,
        p_end: end
      }
    ),

    supabase.rpc(
      "get_dead_stock_by_date",
      {
        p_start: start,
        p_end: end
      }
    ),

    supabase.rpc(
      "get_monthly_trend_by_date",
      {
        p_start: start,
        p_end: end
      }
    )

  ]);

  // ======================
  // EXTRACT DATA
  // ======================

  const valueRows = inventory.data || [];
  const fastRows = fast.data || [];
  const slowRows = slow.data || [];
  const deadRows = dead.data || [];
  const trendRows = trend.data || [];

  // ======================
  // BUILD REPORT
  // ======================

  let text =
`📊 MONTHLY REPORT
${monthInput.toUpperCase()}

`;

  // ======================
  // INVENTORY VALUE
  // ======================

  let totalValue = 0;

  text += "💰 INVENTORY VALUE\n\n";

  valueRows.forEach(r => {

    totalValue += Number(r.total_value);

    text +=
`${toProperCase(r.item)}
Qty: ${r.qty}
RM${Number(r.total_value).toFixed(2)}

`;
  });

  text += `TOTAL: RM${totalValue.toFixed(2)}\n\n`;

  // ======================
  // FAST MOVING
  // ======================

  text += "🔥 FAST MOVING\n\n";

  fastRows.forEach((r, i) => {

    text +=
`${i + 1}. ${toProperCase(r.item)}
Used: ${r.total_out}

`;
  });

  // ======================
  // SLOW MOVING
  // ======================

  text += "🐢 SLOW MOVING\n\n";

  slowRows.forEach((r, i) => {

    text +=
`${i + 1}. ${toProperCase(r.item)}
Used: ${r.total_out}

`;
  });

  // ======================
  // DEAD STOCK
  // ======================

  text += "💀 DEAD STOCK\n\n";

  deadRows.forEach(r => {

    text +=
`${toProperCase(r.item)}
Balance: ${r.qty}

`;
  });

  // ======================
  // TREND
  // ======================

  text += "📈 MONTHLY TREND\n\n";

  trendRows.forEach(r => {

    text +=
`${toProperCase(r.item)}
OUT: ${r.total_out}

`;
  });

  return text;
}

// ======================
// WEBHOOK
// ======================
app.post("/webhook", async (req, res) => {

  let body = {};

  try {
    body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};
  } catch {
    return res.status(200).send("ok");
  }

  const chatId = (
    body.chat_id ||
    body.subscriber_id ||
    body.user_id ||
    ""
  ).split("-")[0];

  // ======================
  // CHECK USER
  // ======================
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();

  // ❌ NOT REGISTERED
  if (!user) {
    return res.end();
  }

  let message =
    body.user_message ||
    body.message ||
    body.text ||
    body.postbackid ||
    "";

  if (!message) {
	return res.status(200).end();
  }

  message = message.replace(/,/g, " ");

  const parts = message.trim().split(/\s+/);

  const type = parts[0]?.toUpperCase();

  console.log("TYPE:", type, "CHAT:", chatId);
  
  // ======================
  // HELP
  // ======================
  if (type === "HELP") {

  const { role } = await checkRole(chatId, ["staff", "manager", "admin"]);

  let guide = getRoleGuide(role);

  return sendWhatsApp(chatId, guide);
}

  // ======================
  // SETROLE
  // ======================
  if (type === "SETROLE") {

    const { ok } = await checkRole(chatId, ["admin"]);

	if (!ok) {
	  await reply(chatId, "❌ ADMIN SAHAJA");
	  return res.status(200).end();
	}

	const target = (parts[1] || "").split("-")[0];
	const targetRole = parts[2];
	const name = parts[3];

	if (!target || !targetRole || !name) {
		await reply(chatId, "❌ FORMAT: SETROLE 60123456789 admin amin");
		return res.status(200).end();
	}

	const { data: existing } = await supabase
	  .from("users")
	  .select("*")
	  .eq("chat_id", target)
	  .maybeSingle();

	await supabase
	  .from("users")
	  .upsert({
		chat_id: target,
		role: targetRole,
		nickname: name
	  });

	const guide = getRoleGuide(targetRole);

	const msg = existing
	  ? `🔄 ROLE UPDATE

	${existing.role.toUpperCase()} → ${targetRole.toUpperCase()}
	${guide}`
	  : `👋 WELCOME

	ROLE: ${targetRole.toUpperCase()}
	${guide}`;

	await sendWhatsApp(target, msg);

	await writeLog(
	  chatId,
	  "admin",
	  "SETROLE",
	  `${target} -> ${targetRole}`
	);

	await reply(chatId, `✅ ${target} → ${targetRole} (${name})`);
	return res.status(200).end();
  }

  // ======================
  // REMOVEROLE
  // ======================
  else if (type === "REMOVEROLE") {

    const { ok, role } = await checkRole(chatId, ["admin"]);

    if (!ok) {
		await reply(chatId, "❌ ADMIN SAHAJA");
		return res.status(200).end();
    }

    const target = (parts[1] || "").split("-")[0];

    await supabase
      .from("users")
      .delete()
      .eq("chat_id", target);

    await writeLog(
      chatId,
      "admin",
      "REMOVEROLE",
      target
    );
	
	await reply(chatId, `🗑️ REMOVED ${target}`);
	return res.status(200).end();
  }

  // ======================
  // STAFF
  // ======================
  else if (type === "STAFF") {

    const { ok, role } = await checkRole(chatId, ["admin"]);

    if (!ok) {
		await reply(chatId, "❌ ADMIN SAHAJA");
		return res.status(200).end();
    }

    const { data: rows } = await supabase
      .from("users")
      .select("*")
      .order("role");

    let text = formatStaff(rows);

    await sendWhatsApp(chatId, text);

    return res.status(200).end();
  }

  // ======================
  // IN
  // ======================
  else if (type === "IN") {

    const { ok, role } = await checkRole(
      chatId,
      ["staff", "manager", "admin"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const item = parts[1]?.toLowerCase();
	const qty = parseInt(parts[2]);

	if (!item || isNaN(qty)) {
	  await reply(chatId, "❌ FORMAT: IN ayam 5");
	  return res.status(200).end();
	}

    const { data: stock } = await supabase
	  .from("stock")
	  .select("item")
	  .eq("item", item)
	  .maybeSingle();

	if (!stock) {
	  await reply(chatId, `❌ ITEM TAK WUJUD: ${item}`);
	  return res.status(200).end();
	}

	await supabase
	  .from("requests")
	  .insert({
		item,
		qty,
		status: "pending",
		type: "in"
	  });

	const summary = `${item} x${qty}`;

    await notifyManagers(
      `📥 STOCK IN\n${summary}\nBY: ${chatId}`,
      chatId
    );

    await writeLog(chatId, user?.role || "unknown", "IN", summary.trim());

    await reply(chatId, "✅ REQUEST SENT");
	return res.status(200).end();
  }

  // ======================
  // OUT
  // ======================
  else if (type === "OUT") {

    const { ok, role } = await checkRole(
      chatId,
      ["staff", "manager", "admin"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const item = parts[1]?.toLowerCase();
	const qty = parseInt(parts[2]);

	if (!item || isNaN(qty)) {
	  await reply(chatId, "❌ FORMAT: OUT ayam 5");
	  return res.status(200).end();
	}

    const { data: stock } = await supabase
	  .from("stock")
	  .select("item")
	  .eq("item", item)
	  .maybeSingle();

	if (!stock) {
	  await reply(chatId, `❌ ITEM TAK WUJUD: ${item}`);
	  return res.status(200).end();
	}

	await supabase
	  .from("requests")
	  .insert({
		item,
		qty,
		status: "pending",
		type: "out"
	  });

	const summary = `${item} x${qty}`;

    await notifyManagers(
      `📤 REQUEST OUT\n${summary}\nBY: ${chatId}`,
      chatId
    );

    await writeLog(chatId, user?.role || "unknown", "OUT", summary.trim());

    await reply(chatId, "✅ REQUEST SENT");
	return res.status(200).end();
  }

  // ======================
  // ADDITEM
  // ======================
  else if (type === "ADDITEM") {

    const { ok, role } = await checkRole(
      chatId,
      ["admin", "manager"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const item = parts[1]?.toLowerCase();

    if (!item) {
		await reply(chatId, "❌ FORMAT: ADDITEM ayam");
		return res.status(200).end();
    }

    const { data: exist } = await supabase
      .from("stock")
      .select("*")
      .eq("item", item)
      .maybeSingle();

    if (exist) {
		await reply(chatId, `⚠️ ITEM SUDAH ADA: ${item}`);
		return res.status(200).end();
    }

    await supabase
      .from("stock")
      .insert({
        item,
        qty: 0
      });

    await writeLog(
      chatId,
      role,
      "ADDITEM",
      item
    );

	await reply(chatId, `✅ ITEM ADDED: ${item}`);
	return res.status(200).end();
  }

  // ======================
  // REMOVEITEM
  // ======================
  else if (type === "REMOVEITEM") {

    const { ok, role } = await checkRole(
      chatId,
      ["admin", "manager"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const item = parts[1]?.toLowerCase();

    if (!item) {
		await reply(chatId, "❌ FORMAT: REMOVEITEM ayam");
		return res.status(200).end();
    }

    await supabase
      .from("stock")
      .delete()
      .eq("item", item);

    await supabase
      .from("requests")
      .delete()
      .eq("item", item)
      .eq("status", "pending");

    await writeLog(
      chatId,
      role,
      "REMOVEITEM",
      item
    );

	await reply(chatId, `🗑️ ITEM REMOVED: ${item}`);
	return res.status(200).end();
  }

  // ======================
  // ITEM
  // ======================
  else if (type === "ITEM") {

    const { ok, role } = await checkRole(
      chatId,
      ["staff", "manager", "admin"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const { data: rows } = await supabase
      .from("stock")
      .select("item")
      .order("item");

    let text = "📦 ITEM LIST\n\n";

    rows.forEach(r => {
      text += `• ${toProperCase(r.item)}\n`;
    });

    await sendWhatsApp(chatId, text);

    return res.status(200).end();
  }

  // ======================
  // LIST
  // ======================
  else if (type === "LIST") {

    const { ok, role } = await checkRole(
      chatId,
      ["staff", "manager", "admin"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const { data: rows } = await supabase
      .from("requests")
      .select("*")
      .eq("status", "pending")
      .order("id");

    await sendWhatsApp(
      chatId,
      formatPending(rows)
    );

    return res.status(200).end();
  }

  // ======================
  // STOCK
  // ======================
  else if (type === "STOCK") {

    const { ok, role } = await checkRole(
      chatId,
      ["staff", "manager", "admin"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const { data: rows } = await supabase
      .from("stock")
      .select("*")
      .order("item");

    let text = formatStock(rows);

    await sendWhatsApp(chatId, text);

    return res.status(200).end();
  }

  // ======================
  // LOG
  // ======================
  else if (type === "LOG") {

    const { ok, role } = await checkRole(
      chatId,
      ["admin", "manager"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    const { data: rows } = await supabase
      .from("logs")
      .select("*")
      .order("id", { ascending: false })
      .limit(50);

	const text = await formatLogs(rows);

	await sendWhatsApp(chatId, text);

    return res.status(200).end();
  }
  
  // ======================
  // REPORT
  // ======================
  else if (type === "REPORT") {

	  const { ok } = await checkRole(
		chatId,
		["manager", "admin"]
	  );

	  if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
	  }

  const monthInput = parts[1] || "current";

  const report = await generateMonthlyReport(monthInput);

  await sendWhatsApp(chatId, report);

  return res.status(200).end();
}

  // ======================
  // REJECT
  // ======================
  else if (type === "REJECT") {

    const { ok, role } = await checkRole(
      chatId,
      ["admin", "manager"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    if (parts[1]) {

      const id = parseInt(parts[1]);

      if (isNaN(id)) {
		await reply(chatId, "❌ ID MESTI NOMBOR");
		return res.status(200).end();
      }

      return processRejectSingle(
        id,
        res,
        chatId,
        role
      );
    }

    return processRejectAll(
      res,
      chatId,
      role
    );
  }

  // ======================
  // APPROVE
  // ======================
  else if (type === "APPROVE") {

    const { ok, role } = await checkRole(
      chatId,
      ["admin", "manager"]
    );

    if (!ok) {
		await reply(chatId, "❌ NO ACCESS");
		return res.status(200).end();
    }

    if (parts[1]) {

      const id = parseInt(parts[1]);

      if (isNaN(id)) {
        await reply(chatId, "❌ ID MESTI NOMBOR");
		return res.status(200).end();
      }

      return processApproveSingle(
        id,
        res,
        chatId,
        role
      );
    }

    const { data: rows } = await supabase
      .from("requests")
      .select("*")
      .eq("status", "pending");

    return processApprove(
      rows,
      res,
      chatId,
      role
    );
  }

  // ======================
  // UNKNOWN
  // ======================
  else {
	return res.status(200).end();

  }

});

// ======================
// APPROVE ENGINE
// ======================
async function processApprove(rows, res, chatId, role) {

  if (!rows?.length) {
		await reply(chatId, "📭 TIADA DATA");
		return res.status(200).end();
  }

  let summary = {};
  let logDetails = [];

  for (const row of rows) {

    // update stock
    if (row.type === "out") {
      await supabase.rpc("decrease_stock", {
        p_item: row.item,
        p_qty: row.qty
      });
    } else {
      await supabase.rpc("increase_stock", {
        p_item: row.item,
        p_qty: row.qty
      });
    }

    await supabase
      .from("requests")
      .update({ status: "approved" })
      .eq("id", row.id);

    summary[row.item] =
      (summary[row.item] || 0) +
      (row.type === "out" ? -row.qty : row.qty);

    const sign = row.type === "out" ? "-" : "+";
    logDetails.push(`ID${row.id} ${row.item} ${sign}${row.qty}`);
  }

  let reply = "✅ APPROVED\n\n";

  Object.entries(summary).forEach(([i, q]) => {
    reply += `${i} ${q > 0 ? "+" : ""}${q}\n`;
  });

  await writeLog(chatId, role, "APPROVE", logDetails.join(" | "));

  await reply(chatId, reply);
  return res.status(200).end();
}

// =====================================================
// APPROVE SINGLE
// =====================================================
async function processApproveSingle(id, res, chatId, role) {

  const { data: row } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!row) {
    await reply(chatId, "❌ ID TIDAK WUJUD");
	return res.status(200).end();
  }

  if (row.status !== "pending") {
	await reply(chatId, `❌ ID ${id} SUDAH ${row.status.toUpperCase()}`);
	return res.status(200).end();
  }

  if (row.type === "out") {
    await supabase.rpc("decrease_stock", {
      p_item: row.item,
      p_qty: row.qty
    });
  } else {
    await supabase.rpc("increase_stock", {
      p_item: row.item,
      p_qty: row.qty
    });
  }

  await supabase
    .from("requests")
    .update({ status: "approved" })
    .eq("id", id);

  const sign = row.type === "out" ? "-" : "+";

  await writeLog(
    chatId,
    role,
    "APPROVE",
    `ID ${id} ${row.item} ${sign}${row.qty}`
  );

  await reply(chatId, `✅ APPROVED\n\nID ${id}\n${row.item} ${sign}${row.qty}`);
  return res.status(200).end();
}


// =====================================================
// REJECT ALL
// =====================================================
async function processRejectAll(res, chatId, role) {

  const { data: rows } = await supabase
    .from("requests")
    .select("*")
    .eq("status", "pending");

  if (!rows?.length) {
	await reply(chatId, "📭 TIADA REQUEST PENDING");
	return res.status(200).end();
  }

  await supabase
    .from("requests")
    .update({ status: "rejected" })
    .eq("status", "pending");

  await writeLog(chatId, role, "REJECT", `${rows.length} request`);

  await reply(chatId, `❌ REJECTED\n\nTotal: ${rows.length} request`);
  return res.status(200).end();
}

// =====================================================
// REJECT SINGLE
// =====================================================
async function processRejectSingle(id, res, chatId, role) {

  const { data: row } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!row) {
    await reply(chatId, "❌ ID TIDAK WUJUD");
	return res.status(200).end();
  }

  if (row.status !== "pending") {
	await reply(chatId, `❌ ID ${id} SUDAH ${row.status.toUpperCase()}`);
	return res.status(200).end();
  }

  await supabase
    .from("requests")
    .update({ status: "rejected" })
    .eq("id", id);

  await writeLog(
    chatId,
    role,
    "REJECT",
    `ID${id} ${row.item} x${row.qty}`
  );

  await reply(chatId, `❌ REJECTED\n\nID ${id}\n${row.item} x${row.qty}`);
  return res.status(200).end();
}

// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});