const { withRole } = require("../core/withRole");
const { getWatchlistStock } = require("../db/stock/getWatchlistStock");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");
const { toProperCase, formatLogDateTime } = require("../utils/helpers");

const MAX_OUTLETS_PER_REPLY = 10; // safety cap — elak flood

// ======================
// FORMAT — single outlet block
// ======================
function formatWatchlistBlock(rows) {
  const categoryMap = new Map();
  rows.forEach(r => {
    const cat = toProperCase(r.items?.category || "Lain-lain");
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat).push(r);
  });

  let text = "";
  let counter = 1;
  for (const [cat, items] of categoryMap) {
    text += `*${cat}*\n`;
    items.forEach(r => {
      const name = toProperCase(r.items?.name || r.item || "-");
      const low = r.qty <= r.min_qty && r.min_qty > 0 ? " ⚠️" : "";
      text += `${counter}. ${name} x ${r.qty} (${r.uom || "UOM"})${low}\n`;
      counter++;
    });
    text += "\n";
  }
  return text.trim();
}

// ======================
// FORMAT — single outlet (staff/supervisor)
// ======================
function formatSingleOutlet(rows) {
  if (!rows.length) return "📋 WATCHLIST KOSONG";
  const outlet = rows[0]?.outlets?.name || "-";
  let text = `📋 WATCHLIST\n🏪 ${toProperCase(outlet)}\n${formatLogDateTime()}\n\n`;
  text += formatWatchlistBlock(rows);
  return text.trim();
}

// ======================
// FORMAT — multi outlet (manager / superadmin scoped)
// Returns ARRAY of messages — 1 outlet = 1 mesej (elak satu mesej terlalu panjang)
// ======================
function formatMultiOutlet(rows) {
  const outletMap = new Map();
  rows.forEach(r => {
    const outlet = r.outlets?.name || "-";
    if (!outletMap.has(outlet)) outletMap.set(outlet, []);
    outletMap.get(outlet).push(r);
  });

  const messages = [];
  outletMap.forEach((items, outlet) => {
    let text = `📋 WATCHLIST\n🏪 ${toProperCase(outlet)}\n${formatLogDateTime()}\n\n`;
    text += formatWatchlistBlock(items);
    messages.push(text.trim());
  });

  return messages;
}

// ======================
// HANDLER
// staff/supervisor → 1 outlet (sendiri)
// manager          → semua outlet dia manage (1 tenant)
// superadmin       → WAJIB specify @slug, takleh global (anti-flood)
// ======================
module.exports = withRole(["staff", "supervisor", "manager"], async (ctx) => {

  const { chatId, user, parts, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  // ======================
  // SUPERADMIN — wajib @slug, tak boleh global
  // ======================
  if (isSuperadmin) {

    const arg = parts[1];

    if (!arg || !arg.startsWith("@")) {
      await reply(chatId, "❌ FORMAT: WATCHLIST @slugtenant\n\n(Superadmin wajib specify tenant — elak flood semua outlet)");
      return res.end();
    }

    const slug = arg.slice(1);
    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
      await reply(chatId, `❌ TENANT TAK WUJUD: ${slug}`);
      return res.end();
    }

    // Get all outlets for this tenant only (scoped, not global)
    const { getAllOutlets } = require("../db/outlets/getAllOutlets");
    const { data: outlets, error } = await getAllOutlets(tenant.id);

    if (error || !outlets?.length) {
      await reply(chatId, "❌ TIADA OUTLET DALAM TENANT INI");
      return res.end();
    }

    const outletIds = outlets.map(o => o.id);

    if (outletIds.length > MAX_OUTLETS_PER_REPLY) {
      await reply(chatId, `⚠️ ${outletIds.length} outlet dijumpai. Terlalu ramai untuk dipaparkan sekali — sila hubungi dev untuk export.`);
      return res.end();
    }

    const rows = await getWatchlistStock(outletIds, tenant.id);

    if (!rows.length) {
      await reply(chatId, "📋 WATCHLIST KOSONG\n\nSila set watch_order untuk item yang dikehendaki.");
      return res.end();
    }

    const messages = formatMultiOutlet(rows);
    for (const msg of messages) {
      await reply(chatId, msg);
    }

    return res.end();
  }

  // ======================
  // STAFF / SUPERVISOR — 1 outlet sahaja
  // ======================
  const tenantId = user.tenant_id || null;

  if (user.role === "staff" || user.role === "supervisor") {

    if (!user.outlet_id) {
      await reply(chatId, "❌ TIADA OUTLET DIBERI AKSES");
      return res.end();
    }

    const rows = await getWatchlistStock([user.outlet_id], tenantId);

    if (!rows.length) {
      await reply(chatId, "📋 WATCHLIST KOSONG\n\nSila hubungi admin untuk set watchlist.");
      return res.end();
    }

    await reply(chatId, formatSingleOutlet(rows));
    return res.end();
  }

  // ======================
  // MANAGER — semua outlet dia manage (tenant sendiri)
  // ======================
  const outletIds = await getAccessibleOutletIds(user);

  if (!outletIds.length) {
    await reply(chatId, "❌ TIADA OUTLET DIBERI AKSES");
    return res.end();
  }

  const rows = await getWatchlistStock(outletIds, tenantId);

  if (!rows.length) {
    await reply(chatId, "📋 WATCHLIST KOSONG\n\nSila set watch_order untuk item yang dikehendaki.");
    return res.end();
  }

  const uniqueOutlets = [...new Set(rows.map(r => r.outlet_id))];

  if (uniqueOutlets.length === 1) {
    await reply(chatId, formatSingleOutlet(rows));
  } else {
    const messages = formatMultiOutlet(rows);
    for (const msg of messages) {
      await reply(chatId, msg);
    }
  }

  return res.end();
});