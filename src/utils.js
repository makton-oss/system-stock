const supabase = require("../services/db");
const { DateTime } = require("luxon");

// ======================
// MODULE: LOGGING
// ======================

async function writeLog(chatId, role, command, details = "") {
  try {
    await supabase.from("logs").insert({
      chat_id: chatId,
      role,
      command,
      details,
    });

    // Keep last 50 logs
    const { data } = await supabase
      .from("logs")
      .select("id")
      .order("id", { ascending: false });

    if (data && data.length > 50) {
      const idsToDelete = data.slice(50).map((x) => x.id);
      await supabase.from("logs").delete().in("id", idsToDelete);
    }
  } catch (err) {
    console.log("LOG ERROR:", err);
  }
}

// ======================
// MODULE: FORMATTING
// ======================

function toProperCase(str = "") {
  return str
    .toString()
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatLogDateTime(date = null) {
  const d = date
    ? DateTime.fromJSDate(new Date(date)).setZone("Asia/Kuala_Lumpur")
    : nowMY();
  return d.toFormat("d/M HH:mm");
}

function formatLowStockAlert(item, qty, minQty) {
  return `⚠️ LOW STOCK ALERT
ITEM: ${toProperCase(item)}
BALANCE: ${qty}
MINIMUM: ${minQty}`;
}

// ======================
// MODULE: USER UTILS
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
    return { nickname: "-", chat_id: "-" };
  }

  return {
    nickname: data.nickname || "-",
    chat_id: data.chat_id,
  };
}

// ======================
// MODULE: ITEM FORMATTING
// ======================

function formatItemList(rows) {
  if (!rows?.length) return "📦 ITEM KOSONG";
  let reply = "📦 ITEM CONFIG\n\n";
  rows.forEach((r) => {
    const name = toProperCase(r.stock_items?.name || r.item || "-");
    const uom = r.uom || "-";
    const cost = Number(r.cost_price || 0);
    const minqty = r.min_qty ?? "-";
    reply += `${name}
UOM: ${uom}
Cost: RM${cost.toFixed(2)}
Min Qty: ${minqty}
`;
  });
  return reply;
}

function formatItemListAdmin(rows) {
  if (!rows?.length) return "📦 ITEM KOSONG";
  const map = {};
  rows.forEach((r) => {
    const outlet = r.outlets?.name || "-";
    if (!map[outlet]) map[outlet] = [];
    map[outlet].push(r);
  });

  let reply = "📦 ITEM CONFIG\n\n";
  Object.entries(map).forEach(([outlet, items]) => {
    reply += `${toProperCase(outlet)}\n\n`;
    items.forEach((r) => {
      const name = toProperCase(
        r.stock_items?.name || r.item || "-"
      );
      const uom = r.uom || "-";
      const cost = Number(r.cost_price || 0);
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
// MODULE: STOCK FORMATTING
// ======================

function formatStockAdmin(rows) {
  if (!rows?.length) return "📦 STOCK KOSONG";
  const map = {};
  rows.forEach((r) => {
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
      const uom = r.uom || "UOM";
      reply += `${i + 1}. ${toProperCase(item)} x ${r.qty} (${uom})\n`;
    });
    reply += "\n\n";
  });
  return reply;
}

function formatStock(rows) {
  if (!rows || rows.length === 0) {
    return "📦 STOCK KOSONG";
  }
  const outlet = rows[0]?.outlets?.name || "-";
  let reply = `📦 STOCK\n🏪 ${toProperCase(outlet)}\n`;
  reply += `${formatLogDateTime()}\n`;
  rows.forEach((r, i) => {
    const item = r.stock_items?.name || r.item || "-";
    const uom = r.uom || "UOM";
    reply += `${i + 1}. ${toProperCase(item)} x ${r.qty} (${uom})\n`;
  });
  return reply;
}

// ======================
// MODULE: PENDING REQUESTS
// ======================

function formatPending(rows) {
  if (!rows?.length) return "📭 TIADA REQUEST";
  const outlet = rows[0]?.outlets?.name || "-";
  let reply = `📋 PENDING LIST\n${toProperCase(outlet)}\n\n`;
  rows.forEach((r) => {
    const date = DateTime
      .fromISO(r.created_at)
      .setZone("Asia/Kuala_Lumpur")
      .toFormat("d/M | HH:mm");
    const userName = r.users?.nickname || "-";
    const chatId = r.users?.chat_id || "-";
    reply += `ID ${r.id} | ${date}
${toProperCase(r.type)} ${toProperCase(r.item)} x ${r.qty}
BY: ${toProperCase(userName)} (${chatId})
`;
  });
  return reply;
}

function formatPendingAdmin(rows) {
  if (!rows?.length) return "📭 TIADA REQUEST";
  const map = {};
  rows.forEach((r) => {
    const outlet = r.outlets?.name || "-";
    if (!map[outlet]) map[outlet] = [];
    map[outlet].push(r);
  });

  let reply = "📋 PENDING LIST\n\n";
  Object.entries(map).forEach(([outlet, list]) => {
    reply += `${toProper案(outlet)}\n\n`;
    list.forEach((r) => {
      const date = DateTime
        .fromISO(r.created_at)
        .setZone("Asia/Kuala_Lumpur")
        .toFormat("d/M | HH:mm");
      const userName = r.users?.nickname || "-";
      const chatId = r.users?.chat_id || "-";
      reply += `ID ${r.id} | ${date}
${toProperCase(r.type)} ${toProperCase(r.item)} x ${r.qty}
BY: ${toProperCase(userName)} (${chatId})
`;
    });
  });
  return reply;
}

// ======================
// MODULE: REPORTS
// ======================

function formatMainReport(data, monthLabel) {
  let text = `📊 STOCK REPORT - ${monthLabel}\n`;
  Object.entries(data).forEach(([outlet, o]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    text += `💰 TOTAL USAGE COST RM ${o.totalCost.toFixed(2)}\n\n`;
    text += "\n📦 CATEGORY COST\n";
    Object.entries(o.categoryMap).forEach(([c, v]) => {
      text += `${c}: RM${v.toFixed(2)}\n`;
    });
    text += `\n💸 FLOW (VALUE)\n`;
    text += `IN   : RM ${o.flowIn.toFixed(2)} (Stock Added)\n`;
    text += `OUT  : RM ${o.flowOut.toFixed(2)} (Stock Used)\n`;
    text += `NET  : RM ${(o.flowIn - o.flowOut).toFixed(2)} (Value Change)\n\n`;
  });
  return text;
}

function formatInventoryReport(data, month) {
  let text = `📦 INVENTORY VALUE REPORT - ${month}\n`;
  Object.entries(data).forEach(([outlet, rows]) => {
    let total = 0;
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    rows.forEach((r) => {
      const val =
        Number(r.qty || 0) *
        Number(r.cost_price || 0);
      total += val;
      text += `${toProperCase(r.item)} x ${r.qty} = RM${val.toFixed(2)}\n`;
    });
    text += `\nTOTAL RM${total.toFixed(2)}\n\n`;
  });
  return text;
}

function formatDetailReport(data, month) {
  let text = `📊 DETAIL INOUT REPORT - ${month}\n`;
  Object.entries(data).forEach(([outlet, rows]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    rows.forEach((r) => {
      text += `${toProperCase(r.name)}\nIN: ${r.in} OUT: ${r.out} BAL:${r.bal}\n\n`;
    });
  });
  return text;
}

function formatDeadReport(data, month) {
  let text = `💀 DEAD STOCK - ${month}\n`;
  Object.entries(data).forEach(([outlet, rows]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    rows.forEach((r, i) => {
      text += `${i + 1}. ${toProperCase(r.name)} (${r.last})\n`;
    });
    text += "\n";
  });
  return text;
}

function formatFlowReport(data, month) {
  let text = `💸 FLOW (Value) REPORT - ${month}\n`;
  Object.entries(data).forEach(([outlet, r]) => {
    text += `OUTLET ${toProperCase(outlet)}\n\n`;
    text += `IN  : RM ${Number(r.inVal || 0).toFixed(2)}\n`;
    text += `OUT : RM ${Number(r.outVal || 0).toFixed(2)}\n`;
    text += `NET : RM ${Number(r.net || 0).toFixed(2)}\n\n`;
    text += "Top 5 IN STOCK\n";
    r.topIn.forEach((t, i) => {
      text += `${i + 1}. ${toProperCase(t[0])} RM${Number(t[1] || 0).toFixed(2)}\n`;
    });
    text += "\nTop 5 OUT STOCK\n";
    r.topOut.forEach((t, i) => {
      text += `${i + 1}. ${toProperCase(t[0])} RM${Number(t[1] || 0).toFixed(2)}\n`;
    });
    text += "\n";
  });
  return text;
}

// ======================
// MODULE: DATE UTILS
// ======================

function nowMY() {
  return DateTime.local().setZone("Asia/Kuala_Lumpur");
}

function parseMonthInput(input) {
  if (!input || input.toLowerCase() === "current") {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
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
    dec: 11,
  };
  const [m, y] = input.toLowerCase().split("-");
  const month = months[m];
  const year = 2000 + parseInt(y);
  if (month === undefined || isNaN(year)) {
    return null;
  }
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
}

function formatMonthLabel(monthInput, startDate) {
  if (!monthInput || monthInput.toLowerCase() === "current") {
    const d = new Date(startDate);
    const month = toProperCase(
      d.toLocaleString("en-MY", {
        month: "long",
      })
    );
    const year = d.getFullYear();
    return `${month} ${year}`;
  }
  return monthInput.toUpperCase();
}

// ======================
// MODULE: ITEM UTILS
// ======================

function formatItemNameList(rows) {
  if (!rows?.length) return "📦 ITEM KOSONG";
  let reply = "📦 ITEM LIST (A-Z)\n\n";
  rows.forEach((r, i) => {
    reply += `${i + 1}. ${toProperCase(r.item)} - ${r.uom}\n`;
  });
  return reply;
}

// ======================
// MODULE: ROLE CHECK
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
      role: null,
    };
  }
  return {
    ok: allowed.includes(data.role),
    role: data.role,
  };
}

// ======================
// MODULE: ROLE GUIDES
// ======================

const ROLE_GUIDE = {
  // Your role guide here (unchanged)
};

// ======================
// EXPORT
// ======================

module.exports = {
  writeLog,
  getUserDisplay,
  toProperCase,
  formatLogDateTime,
  formatLowStockAlert,
  formatItemList,
  formatItemListAdmin,
  formatStock,
  formatStockAdmin,
  formatPending,
  formatPendingAdmin,
  formatMainReport,
  formatInventoryReport,
  formatDetailReport,
  formatDeadReport,
  formatFlowReport,
  nowMY,
  parseMonthInput,
  formatMonthLabel,
  formatItemNameList,
  checkRole,
  ROLE_GUIDE,
};