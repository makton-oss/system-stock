const express = require("express");
const { DateTime } = require("luxon");
const WebSocket = require("ws");
require("dotenv").config();

const supabase = require("./services/db");
const { end, handleDbError, deny, normalizeItem, safeQty, isLowStock } = require("./utils/helpers");
const { getRoleGuide, formatLowStockAlert, writeLog, getUserDisplay, formatLogDateTime, formatStock, formatPending, formatLogs, formatStaff, toProperCase, nowMY, ROLE_GUIDE, parseMonthInput, checkRole } = require("./utils/formatter");
const handlerMap = require("./core/handlerMap");
const { createContext } = require("./core/context");

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

async function notifyManagers(text, outletId, excludeChatId = null) {

  const { data: rows, error } = await supabase
    .from("users")
    .select("chat_id, nickname")
    .eq("role", "manager")
    .eq("outlet_id", outletId);

  if (error || !rows?.length) return;

  const targets = rows.filter(
    u => !excludeChatId || u.chat_id !== excludeChatId
  );

  const batchSize = 5;

  for (let i = 0; i < targets.length; i += batchSize) {

    const batch = targets.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(u => sendWhatsApp(u.chat_id, text))
    );

    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.log("FAILED SEND:", batch[idx].chat_id, r.reason);
      }
    });

    await new Promise(r => setTimeout(r, 500));
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
async function generateMonthlyReport(monthInput, outletId) {

  const range = parseMonthInput(monthInput);

  if (!range) {
    return "❌ FORMAT: REPORT feb-26";
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();

  // ======================
  // FETCH ALL ANALYTICS
  // ======================

  const results = await Promise.all([
	  supabase.rpc("get_inventory_value_by_date", { p_start: start, p_end: end, p_outlet_id: outletId }),
	  supabase.rpc("get_fast_moving_by_date", { p_start: start, p_end: end }),
	  supabase.rpc("get_slow_moving_by_date", { p_start: start, p_end: end }),
	  supabase.rpc("get_dead_stock_by_date", { p_start: start, p_end: end }),
	  supabase.rpc("get_monthly_trend_by_date", { p_start: start, p_end: end })
	]);

	for (const r of results) {
	  if (r.error) {
		console.log("REPORT ERROR:", r.error);
		return "❌ REPORT ERROR";
	  }
	}

	const [inventory, fast, slow, dead, trend] = results;

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
`${toProperCase(r.item)} Qty: ${r.qty} RM${Number(r.total_value).toFixed(2)}

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

  let body = typeof req.body === "string"
    ? JSON.parse(req.body)
    : req.body || {};

  const chatId = (
    body.chat_id ||
    body.subscriber_id ||
    body.user_id ||
    ""
  ).split("-")[0];

  const { data: user } = await supabase
    .from("users")
    .select("*, outlets(name)")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (!user) return res.end();

  let message =
    body.user_message ||
    body.message ||
    body.text ||
    "";

  if (!message) return res.end();

  const parts = message.trim().split(/\s+/);
  const type = parts[0]?.toUpperCase();

  const handler = handlerMap[type];

  if (!handler) return res.end();

  const ctx = createContext({
    chatId,
    user,
    parts,
    res,
    reply
  });

  return handler(ctx);
});

// ======================
// APPROVE ALL
// ======================
async function processApprove(rows, res, chatId, role) {

  if (!rows?.length) {
		await reply(chatId, "📭 TIADA DATA");
		return end(res);
  }

  let summary = {};
  let logDetails = [];

  for (const row of rows) {
	  
	const { data: beforeStock } = await supabase
	  .from("stock")
	  .select("qty, stock_items(min_qty)")
	  .eq("item", row.item)
	  .eq("outlet_id", row.outlet_id)
	  .maybeSingle();

    // update stock
    if (row.type === "out") {
	  await supabase.rpc("decrease_stock", {
		  p_item: row.item,
		  p_qty: row.qty,
		  p_outlet_id: row.outlet_id,
		});
	} else {
	  await supabase.rpc("increase_stock", {
		  p_item: row.item,
		  p_qty: row.qty,
		  p_outlet_id: row.outlet_id,
		});
	}
	
	await supabase
	  .from("stock_movements")
	  .insert({

		outlet_id: row.outlet_id,

		item_id: row.item_id,

		request_id: row.id,

		item: row.item,

		qty: row.qty,

		type: row.type,

		created_by: chatId
	  });

	// ======================
	// LOW STOCK CHECK
	// ======================

	const { data: afterStock } = await supabase
	  .from("stock")
	  .select("qty, stock_items(min_qty)")
	  .eq("item", row.item)
	  .eq("outlet_id", row.outlet_id)
	  .maybeSingle();

	const minQty = afterStock?.stock_items?.min_qty || 0;

	if (
	  beforeStock &&
	  afterStock &&
	  beforeStock.qty > minQty &&
	  afterStock.qty <= minQty
	) {

	  await notifyManagers(
		formatLowStockAlert(
		  row.item,
		  afterStock.qty,
		  afterStock.stock_items?.min_qty || 0
		),
		row.outlet_id
	  );
	}

	await supabase
	  .from("requests")
	  .update({ status: "approved", processed_by: chatId, processed_at: new Date().toISOString() })
	  .eq("id", row.id)
	  .eq("status", "processing");;

    summary[row.item] =
	  (summary[row.item] || 0) +
	  (row.type === "out"
		? -Number(row.qty)
		: Number(row.qty));

    const sign = row.type === "out" ? "-" : "+";
    logDetails.push(`ID${row.id} ${row.item} ${sign}${row.qty}`);
  }

  let text = "✅ APPROVED\n\n";

  Object.entries(summary).forEach(([i, q]) => {
    text += `${i} ${q > 0 ? "+" : ""}${q}\n`;
  });

  await writeLog(chatId, role, "APPROVE", logDetails.join(" | "));

  await reply(chatId, text);
  return end(res);
}

// =====================================================
// APPROVE SINGLE
// =====================================================
async function processApproveSingle(id, res, chatId, role) {

  const { data: row } = await supabase
	  .from("requests")
	  .update({ status: "processing" })
	  .eq("id", id)
	  .eq("status", "pending")
	  .select()
	  .maybeSingle();

	if (!row) {
	  await reply(chatId, `❌ ID ${id} TIADA / SUDAH DIPROSES`);
	  return end(res);
	}
	
	const { data: beforeStock } = await supabase
	  .from("stock")
	  .select("qty, stock_items(min_qty)")
	  .eq("item", row.item)
	  .eq("outlet_id", row.outlet_id)
	  .maybeSingle();

	// update stock
    if (row.type === "out") {
	  await supabase.rpc("decrease_stock", {
		p_item: row.item,
		p_qty: row.qty,
		p_outlet_id: row.outlet_id
	  });
	} else {
	  await supabase.rpc("increase_stock", {
		p_item: row.item,
		p_qty: row.qty,
		p_outlet_id: row.outlet_id
	  });
	}
	
	await supabase
	  .from("stock_movements")
	  .insert({

		outlet_id: row.outlet_id,

		item_id: row.item_id,

		request_id: row.id,

		item: row.item,

		qty: row.qty,

		type: row.type,

		created_by: chatId
	  });

	// ======================
	// LOW STOCK CHECK
	// ======================

	const { data: afterStock } = await supabase
	  .from("stock")
	  .select("qty, stock_items(min_qty)")
	  .eq("item", row.item)
	  .eq("outlet_id", row.outlet_id)
	  .maybeSingle();

	const minQty = afterStock?.stock_items?.min_qty || 0;

	if (
	  beforeStock &&
	  afterStock &&
	  beforeStock.qty > minQty &&
	  afterStock.qty <= minQty
	) {

	  await notifyManagers(
		formatLowStockAlert(
		  row.item,
		  afterStock.qty,
		  afterStock.stock_items?.min_qty || 0
		),
		row.outlet_id
	  );
	}

	await supabase
	  .from("requests")
	  .update({ status: "approved", processed_by: chatId, processed_at: new Date().toISOString() })
	  .eq("id", row.id)
	  .eq("status", "processing");

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
async function processRejectAll(rows, res, chatId, role) {

  if (!rows?.length) {
    await reply(chatId, "📭 TIADA REQUEST PENDING");
    return end(res);
  }

  const ids = rows.map(r => r.id);
  const outletId = rows[0].outlet_id;

  await supabase
    .from("requests")
    .update({
      status: "rejected",
      processed_by: chatId,
      processed_at: new Date().toISOString()
    })
    .in("id", ids)
    .eq("outlet_id", outletId)
    .eq("status", "processing");

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
	  .update({ status: "processing" })
	  .eq("id", id)
	  .eq("status", "pending")
	  .select()
	  .maybeSingle();

	if (!row) {
	  await reply(chatId, `❌ ID ${id} TIADA / SUDAH DIPROSES`);
	  return end(res);
	}

  await supabase
	  .from("requests")
	  .update({ status: "rejected", processed_by: chatId, processed_at: new Date().toISOString() })
	  .eq("id", row.id)
	  .eq("outlet_id", row.outlet_id)
	  .eq("status", "processing");

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