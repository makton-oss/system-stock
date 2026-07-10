const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcrypt");

const { requireDashboardUser, verifyDashboardCredential } = require("../core/requireDashboardUser");
const { getAllTenants }     = require("../db/tenants/getAllTenants");
const { getAllOutlets }     = require("../db/outlets/getAllOutlets");
const { getTenantBySlug }  = require("../db/tenants/getTenantBySlug");
const { voidRequest }      = require("../services/stock/voidRequest");
const { writeLog }         = require("../utils/formatter");
const { runBulkImportItems } = require("../services/imports/runBulkImportItems");
const { runBulkImportUsers } = require("../services/imports/runBulkImportUsers");
const { normalizeItem }    = require("../utils/helpers");
const { getOutletByCode }  = require("../db/outlets/getOutletByCode");
const { createOutlet }     = require("../db/outlets/createOutlet");
const { updateStockItem }  = require("../services/stock/updateItem");
const { deleteStockByItem } = require("../db/stock/deleteStockByItem");
const { addStockItem }     = require("../services/stock/addStockItem");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");
const { setUserActive }    = require("../db/users/setUserActive");
const { upsertUser }       = require("../db/users/upsertUser");
const { removeUserOutletLink } = require("../db/users/removeUserOutletLink");
const { getUserOutletIds, insertUserOutlets, clearUserOutlets } = require("../db/users/manageUserOutlets");
const { checkUserLimit }   = require("../services/tenants/checkUserLimit");
const { getAllItemsByTenant } = require("../db/stock/getAllItemsByTenant");
const { getAllTenants: getAllTenantsDb } = require("../db/tenants/getAllTenants");
const multer = require("multer");
const path   = require("path");
const fs     = require("fs");
const supabase = require("../services/db");

// ======================
// MULTER — temp upload for bulk import
// ======================
const uploadDir = path.join(__dirname, "../tmp_uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.originalname.toLowerCase().endsWith(".xlsx"));
  }
});

// ======================
// LOGIN — public, no middleware
// ======================
router.post("/login", async (req, res) => {
  const { chat_id, credential } = req.body;

  if (!chat_id || !credential) {
    return res.status(400).json({ error: "chat_id dan credential diperlukan" });
  }

  const { getUserByChatId } = require("../db/users/getUserByChatId");
  const user = await getUserByChatId(chat_id);

  if (!user) {
    return res.status(403).json({ error: "USER TAK WUJUD / TIDAK AKTIF" });
  }

  if (!["admin", "owner", "superadmin"].includes(user.role)) {
    return res.status(403).json({ error: "NO ACCESS" });
  }

  const result = await verifyDashboardCredential(user, credential);

  if (!result.ok) {
    return res.status(403).json({ error: result.error });
  }

  // set cookie session
  const cookieVal = encodeURIComponent(chat_id);
  const expires   = new Date(Date.now() + 12 * 60 * 60 * 1000).toUTCString();
  const secure    = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `stokbot_dash_chatid=${cookieVal}; expires=${expires}; path=/; SameSite=Lax; HttpOnly${secure}`);

  res.json({
    ok:           true,
    mustChangePin: result.mustChangePin,
    user: {
      chat_id:  user.chat_id,
      nickname: user.nickname,
      role:     user.role,
      tenant_id: user.tenant_id
    }
  });
});

// ======================
// CHANGE PIN — public (used for first-login force change)
// ======================
router.post("/change-pin", async (req, res) => {
  const { chat_id, current_pin, new_pin } = req.body;

  if (!chat_id || !current_pin || !new_pin) {
    return res.status(400).json({ error: "chat_id, current_pin, new_pin diperlukan" });
  }

  if (new_pin === "123456") {
    return res.status(400).json({ error: "PIN baru tidak boleh sama dengan PIN default" });
  }

  if (!/^\d{6}$/.test(new_pin)) {
    return res.status(400).json({ error: "PIN mesti 6 digit nombor" });
  }

  const { getUserByChatId } = require("../db/users/getUserByChatId");
  const user = await getUserByChatId(chat_id);

  if (!user || !["admin", "owner"].includes(user.role)) {
    return res.status(403).json({ error: "NO ACCESS" });
  }

  const result = await verifyDashboardCredential(user, current_pin);
  if (!result.ok) {
    return res.status(403).json({ error: result.error });
  }

  const hash = await bcrypt.hash(new_pin, 10);
  const { error } = await supabase
    .from("users")
    .update({ dashboard_pin_hash: hash, pin_must_change: false })
    .eq("chat_id", chat_id);

  if (error) return res.status(500).json({ error: "DB_ERROR" });

  res.json({ ok: true });
});

// ======================
// ALL ROUTES BELOW REQUIRE AUTH
// ======================
router.use(requireDashboardUser);

// ======================
// LOGOUT
// ======================
router.post("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "stokbot_dash_chatid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;");
  res.json({ ok: true });
});

// ======================
// CURRENT USER INFO
// ======================
router.get("/me", (req, res) => {
  const u = req.dashboardUser;
  res.json({
    ok: true,
    user: {
      chat_id:   u.chat_id,
      nickname:  u.nickname,
      role:      u.role,
      tenant_id: u.tenant_id
    }
  });
});

// ======================
// TENANTS — superadmin only
// ======================
router.get("/tenants", async (req, res) => {
  if (req.dashboardUser.role !== "superadmin") {
    return res.json({ ok: true, tenants: [] });
  }
  const tenants = await getAllTenants();
  res.json({ ok: true, tenants });
});

// ======================
// OUTLETS
// ======================
router.get("/outlets", async (req, res) => {
  const user = req.dashboardUser;
  let tenantId = user.tenant_id || null;

  if (user.role === "superadmin") {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: "slug diperlukan untuk superadmin" });
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return res.status(400).json({ error: "TENANT TAK WUJUD" });
    tenantId = tenant.id;
  }

  const { data, error } = await getAllOutlets(tenantId);
  if (error) return res.status(500).json({ error: "DB_ERROR" });
  res.json({ ok: true, outlets: data });
});

// ======================
// REQUESTS LIST — approved + voided for one outlet
// ======================
router.get("/requests", async (req, res) => {
  const outletId = Number(req.query.outlet_id);
  if (!outletId) return res.status(400).json({ error: "outlet_id diperlukan" });

  const { data, error } = await supabase
    .from("requests")
    .select(`
      id, type, item, qty, status, created_at, processed_at,
      requested_by, processed_by, voided_by, voided_at, outlet_id,
      outlets(name),
      users(nickname, chat_id)
    `)
    .eq("outlet_id", outletId)
    .in("status", ["approved", "voided"])
    .order("processed_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: "DB_ERROR" });
  res.json({ ok: true, requests: data });
});

// ======================
// REQUEST DETAIL
// ======================
router.get("/requests/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { data, error } = await supabase
    .from("requests")
    .select(`*, outlets(name), users(nickname, chat_id)`)
    .eq("id", id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: "DB_ERROR" });
  if (!data)  return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ ok: true, request: data });
});

// ======================
// VOID ACTION
// ======================
router.post("/void", async (req, res) => {
  const user      = req.dashboardUser;
  const requestId = Number(req.body.request_id);

  if (!requestId) return res.status(400).json({ error: "request_id diperlukan" });

  let result;
  try {
    result = await voidRequest({
      requestId,
      tenantId: user.role === "superadmin" ? null : (user.tenant_id || null),
      voidedBy: user.chat_id
    });
  } catch (err) {
    if (err.message === "OUTLET_LOCKED") {
      return res.status(409).json({ error: "Outlet sedang diproses, cuba lagi sebentar" });
    }
    console.log("VOID ERROR:", err);
    return res.status(500).json({ error: "SYSTEM_ERROR" });
  }

  if (result.error) return res.status(400).json({ error: result.error });

  try {
    await writeLog(user.chat_id, user.role, "VOID", `request_id:${requestId}`, user.tenant_id || null);
  } catch (err) {
    console.log("WRITELOG ERROR:", err);
  }

  res.json({ ok: true, result });
});

// ======================
// IMPORT — ITEMS
// ======================
router.post("/import/items", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "FILE_REQUIRED (.xlsx sahaja)" });

  const slug   = req.body.slug;
  const dryRun = req.body.dryRun === "true";

  if (!slug) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "SLUG_REQUIRED" });
  }

  try {
    const result = await runBulkImportItems({ slug, filePath: req.file.path, dryRun });
    res.json(result);
  } catch (err) {
    console.error("IMPORT ITEMS ERROR:", err);
    res.status(500).json({ error: "IMPORT_FAILED" });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// ======================
// IMPORT — USERS
// ======================
router.post("/import/users", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "FILE_REQUIRED (.xlsx sahaja)" });

  const slug   = req.body.slug;
  const dryRun = req.body.dryRun === "true";

  if (!slug) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "SLUG_REQUIRED" });
  }

  try {
    const result = await runBulkImportUsers({ slug, filePath: req.file.path, dryRun });
    res.json(result);
  } catch (err) {
    console.error("IMPORT USERS ERROR:", err);
    res.status(500).json({ error: "IMPORT_FAILED" });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// ======================
// IMPORT — SINGLE ITEM ADD
// ======================
router.post("/import/add-item", async (req, res) => {
  const { slug, item, category, minQty, cost, uom, outlet } = req.body;

  if (!slug || !item || !category || !uom || !outlet || minQty === undefined || cost === undefined) {
    return res.status(400).json({ error: "Semua field wajib diisi" });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const m = parseInt(minQty), c = parseFloat(cost);
  if (isNaN(m) || isNaN(c)) return res.status(400).json({ error: "minQty/cost tak valid" });

  const outletRow = await getOutletByCode(outlet, tenant.id);
  if (!outletRow) return res.status(400).json({ error: `OUTLET TAK WUJUD: ${outlet}` });

  const result = await addStockItem({ item: normalizeItem(item), category, minQty: m, cost: c, uom, outlet: outletRow, tenantId: tenant.id });
  if (result.error === "STOCK_EXISTS") return res.status(400).json({ error: "ITEM DAH ADA DI OUTLET" });
  if (result.error) return res.status(500).json({ error: `DB ERROR (${result.error})` });

  res.json({ ok: true, item: result.item, outlet: result.outlet });
});

// ======================
// IMPORT — UPDATE ITEM
// ======================
router.post("/import/update-item", async (req, res) => {
  const { slug, item, outlet, cost, minQty } = req.body;

  if (!slug || !item || !outlet) return res.status(400).json({ error: "slug, item, outlet diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const updates = {};
  if (cost !== undefined && cost !== "") {
    const c = parseFloat(cost);
    if (isNaN(c) || c < 0) return res.status(400).json({ error: "Cost tak valid" });
    updates.cost_price = c;
  }
  if (minQty !== undefined && minQty !== "") {
    const m = parseInt(minQty);
    if (isNaN(m) || m < 0) return res.status(400).json({ error: "Min qty tak valid" });
    updates.min_qty = m;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Isi sekurang-kurangnya Cost atau Min Qty" });

  const result = await updateStockItem({ item: normalizeItem(item), outletName: outlet, updates, tenantId: tenant.id });
  if (result.error === "OUTLET_NOT_FOUND") return res.status(400).json({ error: `Outlet tak jumpa: ${outlet}` });
  if (result.error === "ITEM_NOT_FOUND")   return res.status(400).json({ error: `Item tak jumpa: ${item}` });
  if (result.error) return res.status(500).json({ error: "DB ERROR" });

  res.json({ ok: true, item: result.item, outlet: result.outlet, updated: result.updated });
});

// ======================
// IMPORT — REMOVE ITEM
// ======================
router.post("/import/remove-item", async (req, res) => {
  const { slug, item, outlet } = req.body;
  if (!slug || !item || !outlet) return res.status(400).json({ error: "slug, item, outlet diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const outletRow = await getOutletByCode(outlet, tenant.id);
  if (!outletRow) return res.status(400).json({ error: `OUTLET TAK WUJUD: ${outlet}` });

  const { error } = await deleteStockByItem(normalizeItem(item), outletRow.id, tenant.id);
  if (error) return res.status(500).json({ error: "DB ERROR" });

  res.json({ ok: true, item: normalizeItem(item), outlet: outletRow.name });
});

// ======================
// IMPORT — SET ROLE
// ======================
router.post("/import/set-role", async (req, res) => {
  const { slug, phone, role, nickname, outlets } = req.body;
  if (!slug || !phone || !role || !nickname) return res.status(400).json({ error: "slug, phone, role, nickname diperlukan" });

  const VALID_ROLES = ["staff", "supervisor", "manager", "admin", "owner"];
  const roleLower   = role.toLowerCase();
  if (!VALID_ROLES.includes(roleLower)) return res.status(400).json({ error: `ROLE TAK SAH: ${role}` });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const cleanPhone  = String(phone).replace(/[^\d]/g, "");
  const outletNames = (outlets || "").split(",").map(s => s.trim()).filter(Boolean);

  if ((roleLower === "staff" || roleLower === "supervisor") && outletNames.length !== 1) {
    return res.status(400).json({ error: "Staff/Supervisor mesti 1 outlet" });
  }
  if (roleLower === "manager" && !outletNames.length) {
    return res.status(400).json({ error: "Manager mesti ada outlet" });
  }

  const { data: allOutlets } = await getAllOutlets(tenant.id);
  const matched = outletNames.map(name => allOutlets.find(o => o.name.toLowerCase() === name.toLowerCase()));
  if (outletNames.length && matched.some(m => !m)) return res.status(400).json({ error: "Ada outlet tak wujud" });
  const outletIds = matched.filter(Boolean).map(m => m.id);

  const limitCheck = await checkUserLimit(tenant.id);
  if (!limitCheck.allowed) return res.status(400).json({ error: "HAD USER DICAPAI" });

  // auto-set PIN default untuk admin/owner
  let pinFields = {};
  if (roleLower === "admin" || roleLower === "owner") {
    const hash = await bcrypt.hash("123456", 10);
    pinFields  = { dashboard_pin_hash: hash, pin_must_change: true };
  }

  const { error: upsertError } = await supabase
    .from("users")
    .upsert({
      chat_id:   cleanPhone,
      role:      roleLower,
      nickname,
      outlet_id: outletIds[0] || null,
      is_active: true,
      tenant_id: tenant.id,
      ...pinFields
    }, { onConflict: "chat_id" });

  if (upsertError) return res.status(500).json({ error: "ERROR SET ROLE" });

  if (roleLower === "manager") {
    const existingIds = await getUserOutletIds(cleanPhone);
    const newIds      = outletIds.filter(id => !existingIds.includes(id));
    if (newIds.length) await insertUserOutlets(cleanPhone, newIds);
  } else {
    await clearUserOutlets(cleanPhone);
  }

  res.json({ ok: true, phone: cleanPhone, role: roleLower, nickname });
});

// ======================
// IMPORT — REMOVE ROLE
// ======================
router.post("/import/remove-role", async (req, res) => {
  const { slug, phone } = req.body;
  if (!slug || !phone) return res.status(400).json({ error: "slug dan phone diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");
  const targetUser = await verifyUserInTenant(cleanPhone, tenant.id);
  if (!targetUser) return res.status(400).json({ error: "USER TAK WUJUD" });

  const { error } = await setUserActive(cleanPhone, false);
  if (error) return res.status(500).json({ error: "DB ERROR" });

  res.json({ ok: true, phone: cleanPhone });
});

// ======================
// IMPORT — REACTIVATE USER
// ======================
router.post("/import/reactivate-user", async (req, res) => {
  const { slug, phone } = req.body;
  if (!slug || !phone) return res.status(400).json({ error: "slug dan phone diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");
  const targetUser = await verifyUserInTenant(cleanPhone, tenant.id);
  if (!targetUser) return res.status(400).json({ error: "USER TAK WUJUD" });

  const { error } = await setUserActive(cleanPhone, true);
  if (error) return res.status(500).json({ error: "DB ERROR" });

  res.json({ ok: true, phone: cleanPhone });
});

// ======================
// IMPORT — ADD OUTLET
// ======================
router.post("/import/add-outlet", async (req, res) => {
  const { slug, outlet } = req.body;
  if (!slug || !outlet) return res.status(400).json({ error: "slug dan outlet diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const name = normalizeItem(outlet);
  if (!name || name.length < 2) return res.status(400).json({ error: "Nama outlet terlalu pendek" });

  const result = await createOutlet({ name, tenantId: tenant.id });
  if (result.error === "OUTLET_EXISTS") return res.status(400).json({ error: `Outlet sudah wujud: ${name}` });
  if (result.error) return res.status(500).json({ error: "DB ERROR" });

  res.json({ ok: true, outlet: result.outlet });
});

// ======================
// IMPORT — REMOVE OUTLET ACCESS
// ======================
router.post("/import/remove-outlet-access", async (req, res) => {
  const { slug, phone, outlet } = req.body;
  if (!slug || !phone || !outlet) return res.status(400).json({ error: "slug, phone, outlet diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: `TENANT TAK WUJUD: ${slug}` });

  const outletRow  = await getOutletByCode(outlet, tenant.id);
  if (!outletRow)  return res.status(400).json({ error: `OUTLET TAK WUJUD: ${outlet}` });

  const cleanPhone = String(phone).replace(/[^\d]/g, "");
  const targetUser = await verifyUserInTenant(cleanPhone, tenant.id);
  if (!targetUser)  return res.status(400).json({ error: "USER TAK WUJUD" });

  const { error } = await removeUserOutletLink(cleanPhone, outletRow.id);
  if (error) return res.status(400).json({ error: error.message || "ERROR REMOVE OUTLET" });

  res.json({ ok: true, phone: cleanPhone, outlet: outletRow.name });
});

// ======================
// MANAGE USERS — list admin/owner for reset PIN (superadmin only)
// ======================
router.get("/manage/users", async (req, res) => {
  if (req.dashboardUser.role !== "superadmin") {
    return res.status(403).json({ error: "SUPERADMIN ONLY" });
  }

  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ error: "slug diperlukan" });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: "TENANT TAK WUJUD" });

  const { data, error } = await supabase
    .from("users")
    .select("chat_id, nickname, role, is_active, pin_must_change")
    .eq("tenant_id", tenant.id)
    .in("role", ["admin", "owner"])
    .order("nickname");

  if (error) return res.status(500).json({ error: "DB_ERROR" });
  res.json({ ok: true, users: data });
});

// ======================
// RESET PIN — superadmin only
// ======================
router.post("/manage/reset-pin", async (req, res) => {
  if (req.dashboardUser.role !== "superadmin") {
    return res.status(403).json({ error: "SUPERADMIN ONLY" });
  }

  const { target_chat_id } = req.body;
  if (!target_chat_id) return res.status(400).json({ error: "target_chat_id diperlukan" });

  const hash = await bcrypt.hash("123456", 10);
  const { error } = await supabase
    .from("users")
    .update({ dashboard_pin_hash: hash, pin_must_change: true })
    .eq("chat_id", target_chat_id)
    .in("role", ["admin", "owner"]);

  if (error) return res.status(500).json({ error: "DB_ERROR" });

  try {
    await writeLog(req.dashboardUser.chat_id, "superadmin", "RESET_PIN", `target:${target_chat_id}`, null);
  } catch (e) {}

  res.json({ ok: true });
});

// ======================
// DROPDOWN HELPERS
// ======================
router.get("/tenants-list", async (req, res) => {
  const tenants = await getAllTenantsDb();
  res.json({ ok: true, tenants });
});

router.get("/items", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug diperlukan" });
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return res.status(400).json({ error: "TENANT TAK WUJUD" });
  const items = await getAllItemsByTenant(tenant.id);
  res.json({ ok: true, items });
});

module.exports = router;