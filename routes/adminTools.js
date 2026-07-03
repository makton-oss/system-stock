const express = require("express");
const router = express.Router();

const { requireAdminToken } = require("../core/requireAdminToken");
const { normalizeItem }      = require("../utils/helpers");
const { getTenantBySlug }    = require("../db/tenants/getTenantBySlug");
const { getOutletByCode }    = require("../db/outlets/getOutletByCode");
const { getAllOutlets }      = require("../db/outlets/getAllOutlets");
const { createOutlet }       = require("../db/outlets/createOutlet");
const { updateStockItem }    = require("../services/stock/updateItem");
const { deleteStockByItem }  = require("../db/stock/deleteStockByItem");
const { addStockItem }       = require("../services/stock/addStockItem");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");
const { setUserActive }      = require("../db/users/setUserActive");
const { upsertUser }         = require("../db/users/upsertUser");
const { removeUserOutletLink } = require("../db/users/removeUserOutletLink");
const { getUserOutletIds, insertUserOutlets, clearUserOutlets, getUserOutletsDetailed } = require("../db/users/manageUserOutlets");
const { checkUserLimit }     = require("../services/tenants/checkUserLimit");
const { getAllTenants }        = require("../db/tenants/getAllTenants");
const { getAllItemsByTenant }  = require("../db/stock/getAllItemsByTenant");
const { getUsersByTenant }     = require("../db/users/getUsersByTenant");
const { getStockNameList }     = require("../db/stock/getStockItems");

router.use(requireAdminToken);

const WEB_ASSIGNABLE_ROLES = ["staff", "supervisor", "manager", "admin", "owner"]; // superadmin sengaja exclude

// ── UPDATE ITEM (cost / min qty ikut outlet) ──
router.post("/update-item", async (req, res) => {
  const { slug, item, outlet, cost, minQty } = req.body;

  if (!slug || !item || !outlet) {
    return res.status(400).json({ error: "❌ slug, item, outlet diperlukan" });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const updates = {};

  if (cost !== undefined && cost !== "") {
    const c = parseFloat(cost);
    if (isNaN(c) || c < 0) return res.status(400).json({ error: "❌ Cost tak valid" });
    updates.cost_price = c;
  }

  if (minQty !== undefined && minQty !== "") {
    const m = parseInt(minQty);
    if (isNaN(m) || m < 0) return res.status(400).json({ error: "❌ Min qty tak valid" });
    updates.min_qty = m;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "❌ Isi sekurang-kurangnya Cost atau Min Qty" });
  }

  const result = await updateStockItem({
    item: normalizeItem(item),
    outletName: outlet,
    updates,
    tenantId: tenant.id
  });

  if (result.error === "OUTLET_NOT_FOUND") return res.status(400).json({ error: `❌ Outlet tak jumpa: ${result.outlet}` });
  if (result.error === "ITEM_NOT_FOUND")   return res.status(400).json({ error: `❌ Item tak jumpa: ${result.item} di ${result.outlet}` });
  if (result.error)                        return res.status(500).json({ error: "❌ DB ERROR" });

  res.json({ ok: true, item: result.item, outlet: result.outlet, updated: result.updated });
});

// ── ADD ITEM (single) ──
router.post("/add-item", async (req, res) => {
  const { slug, item, category, minQty, cost, uom, outlet } = req.body;

  if (!slug || !item || !category || !uom || !outlet || minQty === undefined || minQty === "" || cost === undefined || cost === "") {
    return res.status(400).json({ error: "❌ Semua field wajib diisi (item, category, minQty, cost, uom, outlet)" });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const m = parseInt(minQty);
  const c = parseFloat(cost);
  if (isNaN(m) || isNaN(c)) return res.status(400).json({ error: "❌ minQty / cost tak valid" });

  const outletRow = await getOutletByCode(outlet, tenant.id);
  if (!outletRow) return res.status(400).json({ error: `❌ OUTLET TAK WUJUD: ${outlet}` });

  const result = await addStockItem({
    item: normalizeItem(item),
    category,
    minQty: m,
    cost: c,
    uom,
    outlet: outletRow,
    tenantId: tenant.id
  });

  if (result.error === "STOCK_EXISTS") return res.status(400).json({ error: "❌ ITEM DAH ADA DI OUTLET" });
  if (result.error)                    return res.status(500).json({ error: `❌ DB ERROR (${result.error})` });

  res.json({ ok: true, item: result.item, outlet: result.outlet });
});

// ── REMOVE ITEM (single) ──
router.post("/remove-item", async (req, res) => {
  const { slug, item, outlet } = req.body;

  if (!slug || !item || !outlet) {
    return res.status(400).json({ error: "❌ slug, item, outlet diperlukan" });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const outletRow = await getOutletByCode(outlet, tenant.id);
  if (!outletRow) return res.status(400).json({ error: `❌ OUTLET TAK WUJUD: ${outlet}` });

  const normalizedItem = normalizeItem(item);
  const { error } = await deleteStockByItem(normalizedItem, outletRow.id, tenant.id);
  if (error) return res.status(500).json({ error: "❌ DB ERROR" });

  res.json({ ok: true, item: normalizedItem, outlet: outletRow.name });
});

// ── SET ROLE (assign role + outlet) ──
router.post("/set-role", async (req, res) => {
  const { slug, phone, role, nickname, outlets } = req.body;

  if (!slug || !phone || !role || !nickname) {
    return res.status(400).json({ error: "❌ slug, phone, role, nickname diperlukan" });
  }

  const roleLower = String(role).toLowerCase();
  if (!WEB_ASSIGNABLE_ROLES.includes(roleLower)) {
    return res.status(400).json({ error: `❌ ROLE TAK SAH: ${role}` });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");

  const outletNames = (outlets || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if ((roleLower === "staff" || roleLower === "supervisor") && outletNames.length !== 1) {
    return res.status(400).json({ error: "❌ STAFF/SUPERVISOR mesti ada exactly 1 outlet" });
  }
  if (roleLower === "manager" && !outletNames.length) {
    return res.status(400).json({ error: "❌ MANAGER mesti ada sekurang-kurangnya 1 outlet" });
  }

  const { data: allOutlets, error: outletErr } = await getAllOutlets(tenant.id);
  if (outletErr) return res.status(500).json({ error: "❌ ERROR OUTLET" });

  const matched = outletNames.map(name =>
    allOutlets.find(o => o.name.toLowerCase() === name.toLowerCase())
  );
  if (outletNames.length && matched.some(m => !m)) {
    return res.status(400).json({ error: "❌ ADA OUTLET TAK WUJUD" });
  }
  const outletIds = matched.map(m => m.id);

  const limitCheck = await checkUserLimit(tenant.id);
  if (!limitCheck.allowed) {
    const msg = limitCheck.reason === "LIMIT_REACHED"
      ? `❌ HAD USER DICAPAI (${limitCheck.current}/${limitCheck.max})`
      : "❌ TENANT TIDAK DIJUMPAI";
    return res.status(400).json({ error: msg });
  }

  const { error: upsertError } = await upsertUser({
    phone: cleanPhone,
    role: roleLower,
    nickname,
    outletId: outletIds[0] || null,
    tenantId: tenant.id
  });
  if (upsertError) return res.status(500).json({ error: "❌ ERROR SET ROLE" });

  if (roleLower === "manager") {
    const existingIds = await getUserOutletIds(cleanPhone);
    const newIds = outletIds.filter(id => !existingIds.includes(id));
    if (newIds.length) await insertUserOutlets(cleanPhone, newIds);
  } else {
    await clearUserOutlets(cleanPhone);
  }

  res.json({ ok: true, phone: cleanPhone, role: roleLower, nickname });
});

// ── REMOVE ROLE (deactivate user) ──
router.post("/remove-role", async (req, res) => {
  const { slug, phone } = req.body;
  if (!slug || !phone) return res.status(400).json({ error: "❌ slug dan phone diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");
  const targetUser = await verifyUserInTenant(cleanPhone, tenant.id);
  if (!targetUser) return res.status(400).json({ error: "❌ USER TAK WUJUD DALAM TENANT" });

  const { error } = await setUserActive(cleanPhone, false);
  if (error) return res.status(500).json({ error: "❌ ERROR REMOVE ROLE" });

  res.json({ ok: true, phone: cleanPhone });
});

// ── REACTIVATE USER ──
router.post("/reactivate-user", async (req, res) => {
  const { slug, phone } = req.body;
  if (!slug || !phone) return res.status(400).json({ error: "❌ slug dan phone diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");
  const targetUser = await verifyUserInTenant(cleanPhone, tenant.id);
  if (!targetUser) return res.status(400).json({ error: "❌ USER TAK WUJUD DALAM TENANT" });

  const { error } = await setUserActive(cleanPhone, true);
  if (error) return res.status(500).json({ error: "❌ ERROR REACTIVATE" });

  res.json({ ok: true, phone: cleanPhone });
});

// ── ADD OUTLET ──
router.post("/add-outlet", async (req, res) => {
  const { slug, outlet } = req.body;
  if (!slug || !outlet) return res.status(400).json({ error: "❌ slug dan outlet diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const name = normalizeItem(outlet);
  if (!name || name.length < 2) return res.status(400).json({ error: "❌ Nama outlet terlalu pendek" });

  const result = await createOutlet({ name, tenantId: tenant.id });
  if (result.error === "OUTLET_EXISTS") return res.status(400).json({ error: `❌ Outlet sudah wujud: ${name}` });
  if (result.error) return res.status(500).json({ error: "❌ DB ERROR" });

  res.json({ ok: true, outlet: result.outlet });
});

// ── REMOVE OUTLET ACCESS (dari user) ──
router.post("/remove-outlet-access", async (req, res) => {
  const { slug, phone, outlet } = req.body;
  if (!slug || !phone || !outlet) return res.status(400).json({ error: "❌ slug, phone, outlet diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const outletRow = await getOutletByCode(outlet, tenant.id);
  if (!outletRow) return res.status(400).json({ error: `❌ OUTLET TAK WUJUD: ${outlet}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");
  const targetUser = await verifyUserInTenant(cleanPhone, tenant.id);
  if (!targetUser) return res.status(400).json({ error: "❌ USER TAK WUJUD DALAM TENANT" });

  const { error } = await removeUserOutletLink(cleanPhone, outletRow.id);
  if (error) return res.status(400).json({ error: error.message ? `❌ ${error.message}` : "❌ ERROR REMOVE OUTLET" });

  res.json({ ok: true, phone: cleanPhone, outlet: outletRow.name });
});

// ── GET TENANTS (dropdown source — reused by all forms below) ──
router.get("/tenants", async (req, res) => {
  const tenants = await getAllTenants();
  res.json({ ok: true, tenants });
});

// ── GET OUTLETS BY SLUG (dropdown source) ──
router.get("/outlets", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "❌ slug diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const { data, error } = await getAllOutlets(tenant.id);
  if (error) return res.status(500).json({ error: "❌ ERROR OUTLET" });

  res.json({ ok: true, outlets: data });
});

// ── GET ITEMS BY SLUG (combobox source — item master, semua outlet) ──
router.get("/items", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "❌ slug diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const items = await getAllItemsByTenant(tenant.id);
  res.json({ ok: true, items });
});

// ── GET USERS BY SLUG + STATUS (dropdown source — remove-role / reactivate / remove-outlet-access) ──
router.get("/users", async (req, res) => {
  const { slug, active } = req.query;
  if (!slug) return res.status(400).json({ error: "❌ slug diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const isActive = active !== "false"; // default true kalau tak specify
  const users = await getUsersByTenant(tenant.id, isActive);

  res.json({ ok: true, users });
});

// ── GET OUTLET ITEMS (dropdown source — remove-item, scoped ke stock outlet tu sahaja) ──
router.get("/outlet-items", async (req, res) => {
  const { slug, outlet } = req.query;
  if (!slug || !outlet) return res.status(400).json({ error: "❌ slug dan outlet diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const outletRow = await getOutletByCode(outlet, tenant.id);
  if (!outletRow) return res.status(400).json({ error: `❌ OUTLET TAK WUJUD: ${outlet}` });

  const items = await getStockNameList(outletRow.id, tenant.id);
  res.json({ ok: true, items });
});

// ── GET USER'S CURRENT OUTLETS (dropdown source — remove-outlet-access, scoped ke user tu je) ──
router.get("/user-outlets", async (req, res) => {
  const { slug, phone } = req.query;
  if (!slug || !phone) return res.status(400).json({ error: "❌ slug dan phone diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `❌ TENANT TAK WUJUD: ${slug}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");
  const targetUser = await verifyUserInTenant(cleanPhone, tenant.id);
  if (!targetUser) return res.status(400).json({ error: "❌ USER TAK WUJUD DALAM TENANT" });

  const outlets = await getUserOutletsDetailed(cleanPhone);
  res.json({ ok: true, outlets });
});

module.exports = router;