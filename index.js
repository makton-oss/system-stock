const express = require("express");
require("dotenv").config();
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SERVICE_ROLE =", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// MIDDLEWARE
// ======================
app.use(express.text({ type: "*/*" }));
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

// ======================
// DATABASE
// ======================
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("ENV MISSING");
}

// ======================
// HELPER
// ======================
function parseItems(parts) {
  let items = {};

  for (let i = 1; i < parts.length; i += 2) {
    let item = parts[i]?.toLowerCase();
    let qty = parseInt(parts[i + 1]);

    if (!item || isNaN(qty)) return null;

    items[item] = (items[item] || 0) + qty;
  }

  return items;
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

💡 Apa tugas anda:
Kemas kini stok bila barang masuk atau keluar stor.

────────────────────

👉 Bila barang baru sampai / restock:
IN ayam 10
IN ikan 5

🟢 Maksud: tambah stok dalam sistem

────────────────────

👉 Bila guna / jual / keluar stok:
OUT ayam 2
OUT ikan 1

🔴 Maksud: kurangkan stok dalam sistem

────────────────────

👉 Nak tengok stok semasa:
STOCK

────────────────────

👉 Nak semak permintaan:
LIST

────────────────────

💡 TIP PENTING:
- IN = barang MASUK
- OUT = barang KELUAR
- Jangan takut format, ikut contoh je 👍
`,

  manager: `
📊 MANAGER GUIDE 

💡 Apa tugas anda:
Semak & luluskan permintaan staf + pantau stok.

────────────────────

👉 Semak semua permintaan staf:
LIST

────────────────────

👉 Luluskan semua permintaan:
APPROVE

👉 Luluskan satu permintaan sahaja:
APPROVE 12

────────────────────

👉 Tolak semua permintaan:
REJECT

👉 Tolak satu permintaan sahaja:
REJECT 12

────────────────────

👉 Semak stok semasa:
STOCK

────────────────────

💡 TIP PENTING:
- APPROVE = setuju & update stok automatik
- REJECT = batalkan permintaan
- Kalau tak pasti, semak LIST dulu 👍
`,

  admin: `
🛠 ADMIN GUIDE

💡 Full control sistem:
- Urus user
- Urus role
- Urus stok

────────────────────

👉 SET ROLE USER:
SETROLE 60123456789 manager ali

👉 REMOVE USER:
REMOVEROLE 60123456789

────────────────────

👉 SENARAI STAFF:
STAFF

👉 SEMAK LOG SYSTEM:
LOG

👉 SEMAK STOK:
STOCK

`
};

function parseMonthInput(input) {

  if (!input || input.toLowerCase() === "current") {

    const now = new Date();

    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
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
    end: new Date(year, month + 1, 0)
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

function formatStock(rows) {

  if (!rows || rows.length === 0) {
    return "📦 STOCK KOSONG";
  }

  let reply = `📦 STOCK\n`;
  reply += `${new Date().toLocaleString()}\n\n`;

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

    const d = new Date(r.created_at);

    const date = `${d.getDate()}/${d.getMonth() + 1}`;
    const time =
      d.getHours().toString().padStart(2, "0") +
      ":" +
      d.getMinutes().toString().padStart(2, "0");

    const name = map[r.chat_id] || r.chat_id;

    reply += `${date} ${time}
CMD: ${r.command}
ITEM: ${r.details || "-"}
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
    await fetch(process.env.BOTCOMMERCE_URL, {
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
  console.log("BODY:", JSON.stringify(body, null, 2));

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
    return res.json({ text: "" });
  }

  message = message.replace(/,/g, " ");

  const parts = message.trim().split(/\s+/);

  const type = parts[0]?.toUpperCase();

  console.log("TYPE:", type, "CHAT:", chatId);
  
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
	  return res.json({ text: "❌ ADMIN SAHAJA" });
	}

	const target = (parts[1] || "").split("-")[0];
	const targetRole = parts[2];
	const name = parts[3];

	if (!target || !targetRole || !name) {
	  return res.json({
		text: "❌ FORMAT: SETROLE 60123456789 admin amin"
	  });
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

	return res.json({
	  text: `✅ ${target} → ${targetRole} (${name})`
	});
  }

  // ======================
  // REMOVEROLE
  // ======================
  else if (type === "REMOVEROLE") {

    const { ok, role } = await checkRole(chatId, ["admin"]);

    if (!ok) {
      return res.json({ text: "❌ ADMIN SAHAJA" });
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

    return res.json({
      text: `🗑️ REMOVED ${target}`
    });
  }

  // ======================
  // STAFF
  // ======================
  else if (type === "STAFF") {

    const { ok, role } = await checkRole(chatId, ["admin"]);

    if (!ok) {
      return res.json({ text: "❌ ADMIN SAHAJA" });
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
      return res.json({ text: "❌ NO ACCESS" });
    }

    const items = parseItems(parts);

    if (!items) {
      return res.json({
        text: "❌ FORMAT SALAH"
      });
    }

    let summary = "";
    let invalid = [];

    for (const item of Object.keys(items)) {

      const { data: stock } = await supabase
        .from("stock")
        .select("item")
        .eq("item", item)
        .maybeSingle();

      if (!stock) {
        invalid.push(item);
        continue;
      }

      let qty = items[item];

      await supabase
        .from("requests")
        .insert({
          item,
          qty,
          status: "pending",
          type: "in"
        });

      summary += `${item} x${qty}\n`;
    }

    if (invalid.length > 0) {
      return res.json({
        text: `❌ ITEM TAK WUJUD:\n${invalid.join("\n")}`
      });
    }

    await notifyManagers(
      `📥 STOCK IN\n${summary}\nBY: ${chatId}`,
      chatId
    );

    await writeLog(chatId, user?.role || "unknown", "IN", summary.trim());

    return res.json({
      text: "✅ REQUEST SENT"
    });
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
      return res.json({ text: "❌ NO ACCESS" });
    }

    const items = parseItems(parts);

    if (!items) {
      return res.json({
        text: "❌ FORMAT SALAH"
      });
    }

    let summary = "";
    let invalid = [];

    for (const item of Object.keys(items)) {

      const { data: stock } = await supabase
        .from("stock")
        .select("item")
        .eq("item", item)
        .maybeSingle();

      if (!stock) {
        invalid.push(item);
        continue;
      }

      let qty = items[item];

      await supabase
        .from("requests")
        .insert({
          item,
          qty,
          status: "pending",
          type: "out"
        });

      summary += `${item} x${qty}\n`;
    }

    if (invalid.length > 0) {
      return res.json({
        text: `❌ ITEM TAK WUJUD:\n${invalid.join("\n")}`
      });
    }

    await notifyManagers(
      `📤 REQUEST OUT\n${summary}\nBY: ${chatId}`,
      chatId
    );

    await writeLog(chatId, user?.role || "unknown", "OUT", summary.trim());

    return res.json({
      text: "✅ REQUEST SENT"
    });
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
      return res.json({ text: "❌ NO ACCESS" });
    }

    const item = parts[1]?.toLowerCase();

    if (!item) {
      return res.json({
        text: "❌ FORMAT: ADDITEM ayam"
      });
    }

    const { data: exist } = await supabase
      .from("stock")
      .select("*")
      .eq("item", item)
      .maybeSingle();

    if (exist) {
      return res.json({
        text: `⚠️ ITEM SUDAH ADA: ${item}`
      });
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

    return res.json({
      text: `✅ ITEM ADDED: ${item}`
    });
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
      return res.json({ text: "❌ NO ACCESS" });
    }

    const item = parts[1]?.toLowerCase();

    if (!item) {
      return res.json({
        text: "❌ FORMAT: REMOVEITEM ayam"
      });
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

    return res.json({
      text: `🗑️ ITEM REMOVED: ${item}`
    });
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
      return res.json({ text: "❌ NO ACCESS" });
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
      return res.json({ text: "❌ NO ACCESS" });
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
      return res.json({ text: "❌ NO ACCESS" });
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
      return res.json({ text: "❌ NO ACCESS" });
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
		return res.json({
		  text: "❌ NO ACCESS"
		});
	  }

  const monthInput = parts[1] || "current";

  const report = await generateMonthlyReport(monthInput);

  await sendWhatsApp(chatId, report);

  return res.end();
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
      return res.json({ text: "❌ NO ACCESS" });
    }

    if (parts[1]) {

      const id = parseInt(parts[1]);

      if (isNaN(id)) {
        return res.json({
          text: "❌ ID MESTI NOMBOR"
        });
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
      return res.json({ text: "❌ NO ACCESS" });
    }

    if (parts[1]) {

      const id = parseInt(parts[1]);

      if (isNaN(id)) {
        return res.json({
          text: "❌ ID MESTI NOMBOR"
        });
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

    return res.json({
      text: ""
    });

  }

});

// ======================
// APPROVE ENGINE
// ======================
async function processApprove(rows, res, chatId, role) {

  if (!rows?.length) {
    return res.json({ text: "📭 TIADA DATA" });
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

  return res.json({ text: reply });
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
    return res.json({ text: "❌ ID TAK WUJUD" });
  }

  if (row.status !== "pending") {
    return res.json({
      text: `❌ ID ${id} SUDAH ${row.status.toUpperCase()}`
    });
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

  return res.json({
    text: `✅ APPROVED\n\nID ${id}\n${row.item} ${sign}${row.qty}`
  });
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
    return res.json({ text: "📭 TIADA REQUEST PENDING" });
  }

  await supabase
    .from("requests")
    .update({ status: "rejected" })
    .eq("status", "pending");

  await writeLog(chatId, role, "REJECT", `${rows.length} request`);

  return res.json({
    text: `❌ REJECTED\n\nTotal: ${rows.length} request`
  });
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
    return res.json({ text: "❌ ID TAK WUJUD" });
  }

  if (row.status !== "pending") {
    return res.json({
      text: `❌ ID ${id} SUDAH ${row.status.toUpperCase()}`
    });
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

  return res.json({
    text: `❌ REJECTED\n\nID ${id}\n${row.item} x${row.qty}`
  });
}

// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});