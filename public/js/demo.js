/* =============================================
   DEMO.JS — StokBot interactive demo logic
   ============================================= */

// ════════════════════════════════════════
// STATE — mirror real system data structure
// Stock update HANYA berlaku selepas APPROVE
// ════════════════════════════════════════
const OUTLET_NAME = "Outlet Demo";

const INITIAL_STOCK = {
  'ayam':          { qty: 12, uom: 'kg',    min: 5,  cost: 18  },
  'tepung gandum': { qty: 8,  uom: 'kg',    min: 3,  cost: 4.5 },
  'minyak masak':  { qty: 4,  uom: 'botol', min: 5,  cost: 12  },
  'garam':         { qty: 15, uom: 'pek',   min: 4,  cost: 2   },
  'gula':          { qty: 6,  uom: 'kg',    min: 3,  cost: 3.5 },
  'santan':        { qty: 3,  uom: 'tin',   min: 4,  cost: 5   },
};

let state = {
  stock: JSON.parse(JSON.stringify(INITIAL_STOCK)),
  pendingRequests: [],
  nextId: 100,
  approvedThisSession: [],
  rejectedThisSession: [],
};

// ════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════

function nowTime() {
  const d = new Date();
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function toProperCase(str = "") {
  return str.toString().toLowerCase().split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function nowDatetime() {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function normalizeItem(text = "") {
  return text.toLowerCase().trim().replace(/-/g, " ").replace(/\s+/g, " ");
}

function safeQty(val) {
  const q = parseInt(val);
  if (isNaN(q) || q <= 0) return null;
  return q;
}

// ════════════════════════════════════════
// RESPONSE BUILDERS
// ════════════════════════════════════════

function buildStockResponse() {
  let text = `📦 STOCK\n🏪 ${toProperCase(OUTLET_NAME)}\n${nowDatetime()}\n`;
  Object.entries(state.stock).forEach(([item, s], i) => {
    const low = s.qty <= s.min ? ' ⚠️' : '';
    text += `${i + 1}. ${toProperCase(item)} x ${s.qty} (${s.uom})${low}\n`;
  });
  return text;
}

function buildStockNotifSingle(req) {
  const emoji = req.type === 'in' ? '📥' : req.type === 'out' ? '📤' : '🗑️';
  return `${emoji} STOCK ${req.type.toUpperCase()} - ${toProperCase(OUTLET_NAME)}\n\nID ${req.id} ${req.item} x${req.qty}\nBY: Ali Hassan`;
}

function buildStockNotifMulti(reqs) {
  let text = `📦 STOCK REQUEST - ${toProperCase(OUTLET_NAME)}\n\n`;
  const grouped = { in: [], out: [], wastage: [] };
  reqs.forEach(r => { if (grouped[r.type]) grouped[r.type].push(r); });

  if (grouped.in.length) {
    text += `📥 IN\nBY: Ali Hassan (60123456789)\n`;
    grouped.in.forEach(r => { text += `ID ${r.id} ${r.item} x${r.qty}\n`; });
    text += '\n';
  }
  if (grouped.out.length) {
    text += `📤 OUT\nBY: Ali Hassan (60123456789)\n`;
    grouped.out.forEach(r => { text += `ID ${r.id} ${r.item} x${r.qty}\n`; });
    text += '\n';
  }
  if (grouped.wastage.length) {
    text += `🗑️ WASTAGE\nBY: Ali Hassan (60123456789)\n`;
    grouped.wastage.forEach(r => { text += `ID ${r.id} ${r.item} x${r.qty}\n`; });
    text += '\n';
  }
  return text;
}

function buildApproveResponse(processed) {
  let text = "✅ APPROVED\n\n";
  processed.forEach(({ req, afterQty, min }) => {
    const sign   = req.type === 'in' ? '+' : '-';
    const balStr = afterQty !== null ? ` ➡️ Baki: ${afterQty}` : '';
    let warn     = '';
    if (afterQty !== null && afterQty <= min) {
      warn = afterQty === 0 ? ' 🚨' : ' ⚠️';
    }
    text += `${req.item} ${sign}${req.qty}${balStr}${warn}\n`;
  });
  return text;
}

function buildRejectResponse() {
  return "✅ REJECTED";
}

function buildLowStockAlert(item, qty, min) {
  return `⚠️ LOW STOCK ALERT\n\nITEM: ${toProperCase(item)}\nBALANCE: ${qty}\nMINIMUM: ${min}`;
}

function buildPendingResponse() {
  const pending = state.pendingRequests;
  if (!pending.length) return "📭 TIADA REQUEST";
  let text = `📋 PENDING LIST\n${toProperCase(OUTLET_NAME)}\n\n`;
  pending.forEach(r => {
    text += `ID ${r.id} | ${nowDatetime()}\n${toProperCase(r.type)} ${toProperCase(r.item)} x ${r.qty}\nBY: Ali Hassan (60123456789)\n\n`;
  });
  return text;
}

function buildListResponse() {
  const pending = state.pendingRequests;
  if (!pending.length) return "📭 TIADA REQUEST";
  let text = `📋 PENDING LIST\n${toProperCase(OUTLET_NAME)}\n\n`;
  pending.forEach(r => {
    text += `ID ${r.id} | ${nowDatetime()}\n${toProperCase(r.type)} ${toProperCase(r.item)} x ${r.qty}\nBY: Ali Hassan (60123456789)\n\n`;
  });
  return text;
}

function buildReportResponse(monthLabel) {
  const totalIn  = state.approvedThisSession.filter(r => r.type === 'in').reduce((a, r) => a + r.qty * (state.stock[r.item]?.cost || 0), 0);
  const totalOut = state.approvedThisSession.filter(r => r.type === 'out').reduce((a, r) => a + r.qty * (state.stock[r.item]?.cost || 0), 0);
  const totalWs  = state.approvedThisSession.filter(r => r.type === 'wastage').reduce((a, r) => a + r.qty * (state.stock[r.item]?.cost || 0), 0);
  const closingVal = Object.values(state.stock).reduce((a, v) => a + v.qty * v.cost, 0);

  const label = monthLabel || (() => {
    const d = new Date();
    return d.toLocaleString('en-MY', { month: 'long' }) + ' ' + d.getFullYear() + ' (1-' + new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() + ')';
  })();

  let text = `📊 MONTHLY REPORT\n${label}\n\n`;
  text += `🏪 ${OUTLET_NAME.toUpperCase()}\n━━━━━━━━━━\n\n`;
  text += `📥 STOCK IN\nRM${totalIn.toFixed(0)}\n\n`;
  text += `💸 STOCK USED\nRM${totalOut.toFixed(0)}\n\n`;
  text += `⚠️ WASTAGE\nRM${totalWs.toFixed(0)}\n\n`;
  text += `📁 CLOSING STOCK\nRM${closingVal.toFixed(2)}\n\n`;

  const totalOutAll = totalOut + totalWs;
  const wastPct = totalOutAll > 0 ? (totalWs / totalOutAll * 100).toFixed(1) : '0.0';
  text += `📉 WASTAGE %\n${wastPct}%\n\n`;

  text += `🔥 TOP USAGE\n`;
  const usageMap = {};
  state.approvedThisSession.filter(r => r.type === 'out').forEach(r => {
    usageMap[r.item] = (usageMap[r.item] || 0) + r.qty * (state.stock[r.item]?.cost || 0);
  });
  const topUsage = Object.entries(usageMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  topUsage.length
    ? topUsage.forEach(([item, val]) => { text += `${toProperCase(item)} RM${val.toFixed(0)}\n`; })
    : text += '-\n';

  text += `\n🧨 TOP WASTAGE\n`;
  const wastMap = {};
  state.approvedThisSession.filter(r => r.type === 'wastage').forEach(r => {
    wastMap[r.item] = (wastMap[r.item] || 0) + r.qty * (state.stock[r.item]?.cost || 0);
  });
  const topWast = Object.entries(wastMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  topWast.length
    ? topWast.forEach(([item, val]) => { text += `${toProperCase(item)} RM${val.toFixed(0)}\n`; })
    : text += '-\n';

  text += '\n━━━━━━━━━━';
  return text;
}

// ════════════════════════════════════════
// ROLE GUIDES
// ════════════════════════════════════════

const ROLE_GUIDE = {
  staff: `📦 STAFF GUIDE

Hai 👋
Gunakan sistem untuk rekod keluar masuk barang.

────────────────────

📥 Barang masuk:
IN ayam 10
IN tepung 5

────────────────────

📤 Barang guna:
OUT ayam 2
OUT tepung 1

────────────────────

🗑️ Rekod wastage:
WASTAGE ayam 2

────────────────────

📦 Semak stok:
STOCK

────────────────────

📋 Semak request:
LIST

────────────────────

⚠️ PENTING:
- Rekod IN dan OUT boleh dibuat pada bila-bila masa
- JANGAN tunggu waktu closing baru nak rekod
- Rekod terus bila barang masuk atau digunakan
- Rekod tepat = stok tepat

❓ Bantuan:
HELP`,

  manager: `📊 MANAGER GUIDE

Hai 👋
Anda urus approval & pantau stok outlet.

────────────────────

📥 Request masuk:
- Notifikasi akan masuk bila staff hantar request
- Tekan butang APPROVE atau REJECT pada notifikasi

────────────────────

📋 Semak request:
PENDING

────────────────────

📦 Semak stok:
STOCK

────────────────────

📊 REPORT

Main report:
REPORT
REPORT may-26

Detail:
REPORT INVENTORY
REPORT DETAIL
REPORT FLOW
REPORT DEAD

────────────────────

👥 Semak staff:
STAFF

────────────────────

⚠️ PENTING:
- Semua request MESTI di-approve atau reject
  sebelum jam 12 malam
- Jangan biarkan request pending hingga esok

❓ Bantuan:
HELP`,

  owner: `👔 OWNER GUIDE

Hai 👋
Pantau operasi dan laporan semua outlet.

────────────────────

📊 REPORT

Main report:
REPORT
REPORT may-26

Detail:
REPORT INVENTORY
REPORT DETAIL
REPORT FLOW
REPORT DEAD

────────────────────

💡 TIPS:
- REPORT untuk tengok prestasi outlet
- STOCK untuk semak stok semua outlet

❓ Bantuan:
HELP`
};

// ════════════════════════════════════════
// RENDER ENGINE
// ════════════════════════════════════════

function addMsg(panel, text, isOut = false, actions = null) {
  const chat = document.getElementById('chat-' + panel);
  const t = chat.querySelector('.typing-wrap');
  if (t) t.remove();

  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap msg-wrap--' + (isOut ? 'out' : 'in');

  const bubble = document.createElement('div');
  bubble.className = 'bubble bubble--' + (isOut ? 'out' : 'in');

  if (!isOut) {
    const sender = document.createElement('div');
    sender.className = 'bubble__sender bubble__sender--' + panel;
    sender.textContent = 'StokBot';
    bubble.appendChild(sender);
  }

  const pre = document.createElement('pre');
  pre.textContent = text;
  bubble.appendChild(pre);

  if (actions) {
    const actDiv = document.createElement('div');
    actDiv.className = 'bubble__actions';
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'bubble__btn bubble__btn--' + a.type;
      btn.textContent = a.label;
      btn.dataset.reqId = a.reqId || '';
      btn.onclick = () => { a.fn(); };
      actDiv.appendChild(btn);
    });
    bubble.appendChild(actDiv);
  }

  const time = document.createElement('div');
  time.className = 'bubble__time';
  time.textContent = nowTime() + (isOut ? ' ✓✓' : '');
  bubble.appendChild(time);

  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function addUserMsg(panel, text) { addMsg(panel, text, true); }

function showTyping(panel) {
  const chat = document.getElementById('chat-' + panel);
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap msg-wrap--in typing-wrap';
  wrap.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping(panel) {
  const t = document.getElementById('chat-' + panel).querySelector('.typing-wrap');
  if (t) t.remove();
}

function setLoading(panel, loading) {
  document.getElementById('input-' + panel).disabled  = loading;
  document.getElementById('send-' + panel).disabled   = loading;
}

function showNotif(panel) { document.getElementById('notif-' + panel)?.classList.add('show'); }
function hideNotif(panel) { document.getElementById('notif-' + panel)?.classList.remove('show'); }

function disableReqButtons(reqId) {
  document.querySelectorAll(`[data-req-id="${reqId}"]`).forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.4';
  });
}

// ════════════════════════════════════════
// COMMAND PROCESSOR
// ════════════════════════════════════════

function processCommand(panel, text) {
  const raw   = text.trim();
  const parts = raw.split(/\s+/);
  const cmd   = parts[0].toUpperCase();

  // ── STAFF ──
  if (panel === 'staff') {
    if (['IN', 'OUT', 'WASTAGE'].includes(cmd)) {
      const qty  = safeQty(parts[parts.length - 1]);
      const item = normalizeItem(parts.slice(1, -1).join(' '));

      if (!item || qty === null) {
        const fmt = cmd === 'IN' ? 'IN ayam 5' : cmd === 'OUT' ? 'OUT ayam 5' : 'WASTAGE ayam 5';
        return `❌ FORMAT: ${fmt}`;
      }
      if (!state.stock[item]) return `❌ ITEM TAK WUJUD: ${item}`;

      const req = { id: state.nextId++, type: cmd.toLowerCase(), item, qty, status: 'pending' };
      state.pendingRequests.push(req);

      setTimeout(() => {
        const pending = state.pendingRequests.filter(r => r.status === 'pending');
        const notifText = pending.length === 1 ? buildStockNotifSingle(req) : buildStockNotifMulti(pending);
        const actions = pending.length === 1
          ? [
              { label: `APPROVE ${req.id}`, type: 'approve', reqId: req.id, fn: () => handleApproveById(req.id) },
              { label: `REJECT ${req.id}`,  type: 'reject',  reqId: req.id, fn: () => handleRejectById(req.id)  }
            ]
          : [
              { label: 'APPROVE ALL', type: 'approve', reqId: 'all', fn: () => handleApproveAll() },
              { label: 'REJECT ALL',  type: 'reject',  reqId: 'all', fn: () => handleRejectAll()  }
            ];
        addMsg('manager', notifText, false, actions);
        showNotif('manager');
      }, 1500);

      return "✅ REQUEST SENT";
    }

    if (cmd === 'STOCK')  return buildStockResponse();
    if (cmd === 'LIST')   return buildListResponse();
    if (cmd === 'HELP')   return ROLE_GUIDE.staff;
    if (['APPROVE', 'REJECT', 'PENDING', 'REPORT', 'STAFF'].includes(cmd)) return "❌ NO ACCESS";
    return `❌ ARAHAN TAK DIKENALI\n\nArahan yang boleh digunakan:\nIN [item] [qty]\nOUT [item] [qty]\nWASTAGE [item] [qty]\nSTOCK\nLIST\nHELP`;
  }

  // ── MANAGER ──
  if (panel === 'manager') {
    if (cmd === 'PENDING') {
      const pending = state.pendingRequests.filter(r => r.status === 'pending');
      if (!pending.length) return "📭 TIADA REQUEST";
      setTimeout(() => {
        addMsg('manager', buildStockNotifMulti(pending), false, [
          { label: 'APPROVE ALL', type: 'approve', reqId: 'all', fn: () => handleApproveAll() },
          { label: 'REJECT ALL',  type: 'reject',  reqId: 'all', fn: () => handleRejectAll()  }
        ]);
      }, 0);
      return null;
    }

    if (/^APPROVE\s+ALL$/i.test(raw))   return handleApproveAllTyped();
    if (/^REJECT\s+ALL$/i.test(raw))    return handleRejectAllTyped();
    if (/^APPROVE\s+\d+$/i.test(raw))   return handleApproveByIdTyped(parseInt(parts[1]));
    if (/^REJECT\s+\d+$/i.test(raw))    return handleRejectByIdTyped(parseInt(parts[1]));
    if (cmd === 'STOCK')  return buildStockResponse();
    if (cmd === 'REPORT') {
      const label = buildMonthLabel(parts[1] || 'current');
      return label ? buildReportResponse(label) : "❌ FORMAT: REPORT may-26";
    }
    if (cmd === 'STAFF') return `👥 STAFF LIST\n${toProperCase(OUTLET_NAME)}\n\nManager\n1. Razif - 60111234567\n\nStaff\n1. Ali Hassan - 60197654321`;
    if (cmd === 'HELP')  return ROLE_GUIDE.manager;
    if (['IN', 'OUT', 'WASTAGE'].includes(cmd)) return "❌ NO ACCESS";
    return `❌ ARAHAN TAK DIKENALI\n\nArahan yang boleh digunakan:\nPENDING\nAPPROVE [ID]\nREJECT [ID]\nSTOCK\nREPORT\nSTAFF\nHELP`;
  }

  // ── OWNER ──
  if (panel === 'owner') {
    if (cmd === 'STOCK')  return buildStockResponse();
    if (cmd === 'REPORT') {
      const label = buildMonthLabel(parts[1] || 'current');
      return label ? buildReportResponse(label) : "❌ FORMAT: REPORT may-26";
    }
    if (cmd === 'STAFF') return `👥 STAFF LIST\n${toProperCase(OUTLET_NAME)}\n\nManager\n1. Razif - 60111234567\n\nStaff\n1. Ali Hassan - 60197654321`;
    if (cmd === 'HELP')  return ROLE_GUIDE.owner;
    if (['APPROVE', 'REJECT', 'PENDING', 'IN', 'OUT', 'WASTAGE'].includes(cmd)) return "❌ NO ACCESS";
    return `❌ ARAHAN TAK DIKENALI\n\nArahan yang boleh digunakan:\nREPORT\nSTOCK\nSTAFF\nHELP`;
  }

  return null;
}

// ════════════════════════════════════════
// APPROVE / REJECT HANDLERS
// ════════════════════════════════════════

function applyStockUpdate(req) {
  const s = state.stock[req.item];
  if (!s) return { afterQty: null, min: 0 };
  if (req.type === 'in') {
    s.qty += req.qty;
  } else {
    s.qty = Math.max(0, s.qty - req.qty);
  }
  return { afterQty: s.qty, min: s.min };
}

function _checkLowStock(processed) {
  processed.forEach(({ req, afterQty, min }) => {
    if (afterQty !== null && afterQty <= min && (req.type === 'out' || req.type === 'wastage')) {
      setTimeout(() => addMsg('manager', buildLowStockAlert(req.item, afterQty, min)), 800);
    }
  });
}

function handleApproveById(id) {
  const idx = state.pendingRequests.findIndex(r => r.id === id && r.status === 'pending');
  if (idx === -1) return;

  const req = state.pendingRequests[idx];
  req.status = 'approved';
  state.pendingRequests.splice(idx, 1);

  const { afterQty, min } = applyStockUpdate(req);
  state.approvedThisSession.push(req);
  disableReqButtons(id);
  disableReqButtons('all');

  addUserMsg('manager', `APPROVE ${id}`);
  showTyping('manager');
  setTimeout(() => {
    removeTyping('manager');
    addMsg('manager', buildApproveResponse([{ req, afterQty, min }]));
    _checkLowStock([{ req, afterQty, min }]);
    if (!state.pendingRequests.filter(r => r.status === 'pending').length) hideNotif('manager');
  }, 800);
}

function handleRejectById(id) {
  const idx = state.pendingRequests.findIndex(r => r.id === id && r.status === 'pending');
  if (idx === -1) return;

  const req = state.pendingRequests[idx];
  req.status = 'rejected';
  state.pendingRequests.splice(idx, 1);
  state.rejectedThisSession.push(req);
  disableReqButtons(id);
  disableReqButtons('all');

  addUserMsg('manager', `REJECT ${id}`);
  showTyping('manager');
  setTimeout(() => {
    removeTyping('manager');
    addMsg('manager', buildRejectResponse());
    if (!state.pendingRequests.filter(r => r.status === 'pending').length) hideNotif('manager');
  }, 600);
}

function handleApproveAll() {
  const pending = state.pendingRequests.filter(r => r.status === 'pending');
  if (!pending.length) return;

  disableReqButtons('all');
  pending.forEach(r => disableReqButtons(r.id));

  const processed = [];
  pending.forEach(req => {
    req.status = 'approved';
    const { afterQty, min } = applyStockUpdate(req);
    state.approvedThisSession.push(req);
    processed.push({ req, afterQty, min });
  });
  state.pendingRequests = state.pendingRequests.filter(r => r.status === 'pending');
  hideNotif('manager');

  addUserMsg('manager', 'APPROVE ALL');
  showTyping('manager');
  setTimeout(() => {
    removeTyping('manager');
    addMsg('manager', buildApproveResponse(processed));
    _checkLowStock(processed);
  }, 800);
}

function handleRejectAll() {
  const pending = state.pendingRequests.filter(r => r.status === 'pending');
  if (!pending.length) return;

  disableReqButtons('all');
  pending.forEach(req => {
    disableReqButtons(req.id);
    req.status = 'rejected';
    state.rejectedThisSession.push(req);
  });
  state.pendingRequests = state.pendingRequests.filter(r => r.status === 'pending');
  hideNotif('manager');

  addUserMsg('manager', 'REJECT ALL');
  showTyping('manager');
  setTimeout(() => { removeTyping('manager'); addMsg('manager', buildRejectResponse()); }, 600);
}

// typed versions
function handleApproveByIdTyped(id) {
  const req = state.pendingRequests.find(r => r.id === id && r.status === 'pending');
  if (!req) return "📭 TIADA DATA";

  req.status = 'approved';
  state.pendingRequests = state.pendingRequests.filter(r => r.id !== id);
  const { afterQty, min } = applyStockUpdate(req);
  state.approvedThisSession.push(req);
  disableReqButtons(id);
  disableReqButtons('all');
  if (!state.pendingRequests.filter(r => r.status === 'pending').length) hideNotif('manager');

  setTimeout(() => {
    if (afterQty !== null && afterQty <= min && (req.type === 'out' || req.type === 'wastage')) {
      addMsg('manager', buildLowStockAlert(req.item, afterQty, min));
    }
  }, 1200);

  return buildApproveResponse([{ req, afterQty, min }]);
}

function handleRejectByIdTyped(id) {
  const req = state.pendingRequests.find(r => r.id === id && r.status === 'pending');
  if (!req) return "📭 TIADA DATA";

  req.status = 'rejected';
  state.pendingRequests = state.pendingRequests.filter(r => r.id !== id);
  state.rejectedThisSession.push(req);
  disableReqButtons(id);
  disableReqButtons('all');
  if (!state.pendingRequests.filter(r => r.status === 'pending').length) hideNotif('manager');
  return buildRejectResponse();
}

function handleApproveAllTyped() {
  const pending = state.pendingRequests.filter(r => r.status === 'pending');
  if (!pending.length) return "📭 TIADA DATA";

  const processed = [];
  pending.forEach(req => {
    req.status = 'approved';
    const { afterQty, min } = applyStockUpdate(req);
    state.approvedThisSession.push(req);
    processed.push({ req, afterQty, min });
    disableReqButtons(req.id);
  });
  state.pendingRequests = state.pendingRequests.filter(r => r.status === 'pending');
  disableReqButtons('all');
  hideNotif('manager');

  setTimeout(() => _checkLowStock(processed), 1200);
  return buildApproveResponse(processed);
}

function handleRejectAllTyped() {
  const pending = state.pendingRequests.filter(r => r.status === 'pending');
  if (!pending.length) return "📭 TIADA DATA";

  pending.forEach(req => {
    req.status = 'rejected';
    state.rejectedThisSession.push(req);
    disableReqButtons(req.id);
  });
  state.pendingRequests = state.pendingRequests.filter(r => r.status === 'pending');
  disableReqButtons('all');
  hideNotif('manager');
  return buildRejectResponse();
}

// ════════════════════════════════════════
// MONTH LABEL BUILDER
// ════════════════════════════════════════

function buildMonthLabel(input) {
  if (!input || input.toLowerCase() === 'current') {
    const d = new Date();
    return d.toLocaleString('en-MY', { month: 'long' }) + ' ' + d.getFullYear()
      + ' (1-' + new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() + ')';
  }
  const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  const [m, y] = input.toLowerCase().split('-');
  if (!months.hasOwnProperty(m) || !y) return null;
  const year = 2000 + parseInt(y);
  if (isNaN(year)) return null;
  const d = new Date(year, months[m], 1);
  return d.toLocaleString('en-MY', { month: 'long' }) + ' ' + year
    + ' (1-' + new Date(year, months[m] + 1, 0).getDate() + ')';
}

// ════════════════════════════════════════
// SEND MESSAGE HANDLER
// ════════════════════════════════════════

function sendMessage(panel) {
  const input = document.getElementById('input-' + panel);
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  addUserMsg(panel, text);
  setLoading(panel, true);
  showTyping(panel);

  setTimeout(() => {
    removeTyping(panel);
    setLoading(panel, false);
    const response = processCommand(panel, text);
    if (response !== null) addMsg(panel, response);
  }, 400);
}

// ════════════════════════════════════════
// RESET
// ════════════════════════════════════════

function resetDemo() {
  ['staff', 'manager', 'owner'].forEach(p => {
    document.getElementById('chat-' + p).innerHTML = '';
  });
  state = {
    stock: JSON.parse(JSON.stringify(INITIAL_STOCK)),
    pendingRequests: [],
    nextId: 100,
    approvedThisSession: [],
    rejectedThisSession: [],
  };
  hideNotif('manager');
  initWelcome();
}

// ════════════════════════════════════════
// WELCOME MESSAGES
// ════════════════════════════════════════

function initWelcome() {
  setTimeout(() => {
    addMsg('staff', `📦 STAFF GUIDE\n\nHai 👋\nAnda log masuk sebagai:\nHassan - Staff\n${toProperCase(OUTLET_NAME)}\n\nArahan yang boleh digunakan:\n→ IN ayam 5\n→ OUT tepung 2\n→ WASTAGE gula 1\n→ STOCK\n→ LIST\n→ HELP`);
  }, 300);
  setTimeout(() => {
    addMsg('manager', `📊 MANAGER GUIDE\n\nHai 👋\nAnda log masuk sebagai:\nKamil - Manager\n${toProperCase(OUTLET_NAME)}\n\nAnda akan terima notifikasi apabila staff hantar request.\n\nArahan yang boleh digunakan:\n→ PENDING\n→ APPROVE [ID]\n→ REJECT [ID]\n→ STOCK\n→ REPORT\n→ STAFF\n→ HELP`);
  }, 500);
  setTimeout(() => {
    addMsg('owner', `👔 OWNER GUIDE\n\nHai 👋\nAnda log masuk sebagai:\nFarid - Owner\nSemua Outlet\n\nPantau prestasi outlet anda:\n→ REPORT\n→ STOCK\n→ STAFF\n→ HELP`);
  }, 700);
}

// ════════════════════════════════════════
// ENTER KEY & AUTO RESIZE
// ════════════════════════════════════════

['staff', 'manager', 'owner'].forEach(p => {
  const inp = document.getElementById('input-' + p);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(p);
    }
  });
  inp.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  });
});

// init
initWelcome();
