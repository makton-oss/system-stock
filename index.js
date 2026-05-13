const express = require("express");
const { DateTime } = require("luxon");
const WebSocket = require("ws");
require("dotenv").config();

const supabase = require("./services/db");
const { end, handleDbError, deny, normalizeItem, safeQty, isLowStock } = require("./utils/helpers");
const { getRoleGuide, formatLowStockAlert, writeLog, getUserDisplay, formatLogDateTime, formatStock, formatPending, formatLogs, formatStaff, toProperCase, nowMY, ROLE_GUIDE, parseMonthInput, checkRole } = require("./utils/formatter");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// MIDDLEWARE
// ======================
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

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
	  throw new Error(errText);
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
    return end(res);
  }

  let message =
    body.user_message ||
    body.message ||
    body.text ||
    body.postbackid ||
    "";

  if (!message) {
	return end(res);
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
		await deny(chatId, reply);
		return end(res);
	}

	const target = (parts[1] || "").split("-")[0];
	const targetRole = parts[2];
	const name = parts[3];

	if (!target || !targetRole || !name) {
		await reply(chatId, "❌ FORMAT: SETROLE 60123456789 admin amin");
		return end(res);
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
	return end(res);
  }

  // ======================
  // REMOVEROLE
  // ======================
  else if (type === "REMOVEROLE") {

    const { ok, role } = await checkRole(chatId, ["admin"]);

    if (!ok) {
		await deny(chatId, reply);
		return end(res);
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
	return end(res);
  }

  // ======================
  // STAFF
  // ======================
  else if (type === "STAFF") {

    const { ok, role } = await checkRole(chatId, ["admin"]);

    if (!ok) {
		await deny(chatId, reply);
		return end(res);
    }

    const { data: rows } = await supabase
      .from("users")
      .select("*")
      .order("role");

    let text = formatStaff(rows);

    await sendWhatsApp(chatId, text);

    return end(res);
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
		await deny(chatId, reply);
		return end(res);
    }

    const item = parts[1]?.toLowerCase();
	const qty = parseInt(parts[2]);

	if (!item || isNaN(qty)) {
	  await reply(chatId, "❌ FORMAT: IN ayam 5");
	  return end(res);
	}

    const { data: stock } = await supabase
	  .from("stock")
	  .select("item")
	  .eq("item", item)
	  .maybeSingle();

	if (!stock) {
	  await reply(chatId, `❌ ITEM TAK WUJUD: ${item}`);
	  return end(res);
	}

	const { error } = await supabase
	  .from("requests")
	  .insert({
		item,
		qty,
		status: "pending",
		type: "in"
	  });

	if (await handleDbError(error, chatId, reply)) {
	  return end(res);
	}

	const summary = `${item} x${qty}`;

    await notifyManagers(
      `📥 STOCK IN\n${summary}\nBY: ${chatId}`,
      chatId
    );

    await writeLog(chatId, user?.role || "unknown", "IN", summary.trim());

    await reply(chatId, "✅ REQUEST SENT");
	return end(res);
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
		await deny(chatId, reply);
		return end(res);
    }

    const item = parts[1]?.toLowerCase();
	const qty = parseInt(parts[2]);

	if (!item || isNaN(qty)) {
	  await reply(chatId, "❌ FORMAT: OUT ayam 5");
	  return end(res);
	}

    const { data: stock } = await supabase
	  .from("stock")
	  .select("item")
	  .eq("item", item)
	  .maybeSingle();

	if (!stock) {
	  await reply(chatId, `❌ ITEM TAK WUJUD: ${item}`);
	  return end(res);
	}

	const { error } = await supabase
	  .from("requests")
	  .insert({
		item,
		qty,
		status: "pending",
		type: "out"
	  });

	if (await handleDbError(error, chatId, reply)) {
	  return end(res);
	}

	const summary = `${item} x${qty}`;

    await notifyManagers(
      `📤 REQUEST OUT\n${summary}\nBY: ${chatId}`,
      chatId
    );

    await writeLog(chatId, user?.role || "unknown", "OUT", summary.trim());

    await reply(chatId, "✅ REQUEST SENT");
	return end(res);
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
		return end(res);
    }

    const item = parts[1]?.toLowerCase();

    if (!item) {
		await reply(chatId, "❌ FORMAT: ADDITEM ayam");
		return end(res);
    }

    const { data: exist } = await supabase
      .from("stock")
      .select("*")
      .eq("item", item)
      .maybeSingle();

    if (exist) {
		await reply(chatId, `⚠️ ITEM SUDAH ADA: ${item}`);
		return end(res);
    }

    const { error } = await supabase
	  .from("stock")
	  .insert({
		item,
		qty: 0
	  });

	if (await handleDbError(error, chatId, reply)) {
	  return end(res);
	}

    await writeLog(
      chatId,
      role,
      "ADDITEM",
      item
    );

	await reply(chatId, `✅ ITEM ADDED: ${item}`);
	return end(res);
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
		await deny(chatId, reply);
		return end(res);
    }

    const item = parts[1]?.toLowerCase();

    if (!item) {
		await reply(chatId, "❌ FORMAT: REMOVEITEM ayam");
		return end(res);
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
	return end(res);
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
		await deny(chatId, reply);
		return end(res);
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

    return end(res);
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
		await deny(chatId, reply);
		return end(res);
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

    return end(res);
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
		await deny(chatId, reply);
		return end(res);
    }

    const { data: rows } = await supabase
      .from("stock")
      .select("*")
      .order("item");

    let text = formatStock(rows);

    await sendWhatsApp(chatId, text);

    return end(res);
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
		await deny(chatId, reply);
		return end(res);
    }

    const { data: rows } = await supabase
      .from("logs")
      .select("*")
      .order("id", { ascending: false })
      .limit(50);

	const text = await formatLogs(rows);

	await sendWhatsApp(chatId, text);

    return end(res);
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
		await deny(chatId, reply);
		return end(res);
	  }

  const monthInput = parts[1] || "current";

  const report = await generateMonthlyReport(monthInput);

  await sendWhatsApp(chatId, report);

  return end(res);
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
		await deny(chatId, reply);
		return end(res);
    }

    if (parts[1]) {

      const id = parseInt(parts[1]);

      if (isNaN(id)) {
		await reply(chatId, "❌ ID MESTI NOMBOR");
		return end(res);
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
		await deny(chatId, reply);
		return end(res);
    }

    if (parts[1]) {

      const id = parseInt(parts[1]);

      if (isNaN(id)) {
        await reply(chatId, "❌ ID MESTI NOMBOR");
		return end(res);
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
	return end(res);

  }

});

// ======================
// APPROVE ENGINE
// ======================
async function processApprove(rows, res, chatId, role) {

  if (!rows?.length) {
		await reply(chatId, "📭 TIADA DATA");
		return end(res);
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

	// ======================
	// LOW STOCK CHECK
	// ======================

	const { data: latestStock } = await supabase
	  .from("stock")
	  .select("qty, min_qty")
	  .eq("item", row.item)
	  .maybeSingle();

	if ( latestStock && latestStock.qty <= latestStock.min_qty) {
	  await notifyManagers( formatLowStockAlert( row.item, latestStock.qty, latestStock.min_qty));
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
  return end(res);
}

// =====================================================
// APPROVE SINGLE
// =====================================================
async function processApproveSingle(id, res, chatId, role) {

  const { data: row } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    await reply(chatId, "❌ ID TIDAK WUJUD");
	return end(res);
  }

  if (row.status !== "pending") {
	await reply(chatId, `❌ ID ${id} SUDAH ${row.status.toUpperCase()}`);
	return end(res);
  }

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

	// ======================
	// LOW STOCK CHECK
	// ======================

	const { data: latestStock } = await supabase
	  .from("stock")
	  .select("qty, min_qty")
	  .eq("item", row.item)
	  .maybeSingle();

	if ( latestStock && latestStock.qty <= latestStock.min_qty) {
	  await notifyManagers( formatLowStockAlert( row.item, latestStock.qty, latestStock.min_qty));
	}

	await supabase
	  .from("requests")
	  .update({ status: "approved" })
	  .eq("id", row.id);

  const sign = row.type === "out" ? "-" : "+";

  await writeLog(
    chatId,
    role,
    "APPROVE",
    `ID ${id} ${row.item} ${sign}${row.qty}`
  );

  await reply(chatId, `✅ APPROVED\n\nID ${id}\n${row.item} ${sign}${row.qty}`);
  return end(res);
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
	return end(res);
  }

  await supabase
    .from("requests")
    .update({ status: "rejected" })
    .eq("status", "pending");

  await writeLog(chatId, role, "REJECT", `${rows.length} request`);

  await reply(chatId, `❌ REJECTED\n\nTotal: ${rows.length} request`);
  return end(res);
}

// =====================================================
// REJECT SINGLE
// =====================================================
async function processRejectSingle(id, res, chatId, role) {

  const { data: row } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    await reply(chatId, "❌ ID TIDAK WUJUD");
	return end(res);
  }

  if (row.status !== "pending") {
	await reply(chatId, `❌ ID ${id} SUDAH ${row.status.toUpperCase()}`);
	return end(res);
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
  return end(res);
}

// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});