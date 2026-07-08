const express = require("express");
const router = express.Router();

const { requireDashboardUser } = require("../core/requireDashboardUser");
const { getAllTenants }   = require("../db/tenants/getAllTenants");
const { getAllOutlets }   = require("../db/outlets/getAllOutlets");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");
const { voidRequest }     = require("../services/stock/voidRequest");
const { writeLog }        = require("../utils/formatter");
const supabase = require("../services/db");

router.use(requireDashboardUser);

// ======================
// TENANTS — superadmin only (for tenant dropdown)
// ======================
router.get("/tenants", async (req, res) => {
  if (req.dashboardUser.role !== "superadmin") {
    return res.json({ ok: true, tenants: [] });
  }
  const tenants = await getAllTenants();
  res.json({ ok: true, tenants });
});

// ======================
// OUTLETS — scoped by role
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
// REQUESTS — approved + voided only, for one outlet
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
  if (!data) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ ok: true, request: data });
});

// ======================
// VOID ACTION
// ======================
router.post("/void", async (req, res) => {
  const user = req.dashboardUser;
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
      return res.status(409).json({ error: "⏳ Outlet sedang diproses, cuba lagi sebentar" });
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

module.exports = router;