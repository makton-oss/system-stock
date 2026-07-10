const { withRole } = require("../core/withRole");
const { getRoleGuide } = require("../utils/formatter");
const { getAllOutlets } = require("../db/outlets/getAllOutlets");
const { upsertUser } = require("../db/users/upsertUser");
const { getUserOutletIds, insertUserOutlets, clearUserOutlets } = require("../db/users/manageUserOutlets");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");
const { checkUserLimit } = require("../services/tenants/checkUserLimit");
const supabase = require("../services/db");
const ASSIGNABLE_ROLES = ["staff", "supervisor", "manager", "admin", "owner"];

// ======================
// PARSE SUPERADMIN FORMAT
// phone@slug role nickname outlet1,outlet2
// ======================
function parseSuperadminArgs(parts) {
  // parts[1] = phone@slug
  const [phone, slug] = parts[1].split("@");
  if (!phone || !slug) return null;

  return {
    phone: phone.replace(/[^\d]/g, ""),
    slug,
    role:        parts[2]?.toLowerCase(),
    nickname:    parts[3],
    outletNames: parts.slice(4).join(" ").split(",")
  };
}

// ======================
// PARSE ADMIN FORMAT
// phone role nickname outlet1,outlet2
// ======================
function parseAdminArgs(parts) {
  return {
    phone:       parts[1].replace(/[^\d]/g, ""),
    role:        parts[2]?.toLowerCase(),
    nickname:    parts[3],
    outletNames: parts.slice(4).join(" ").split(",")
  };
}

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  // ======================
  // ARG COUNT CHECK
  // ======================
  const minParts = isSuperadmin ? 5 : 5;
  if (parts.length < minParts) {
    const fmt = isSuperadmin
      ? "❌ FORMAT: SETROLE 60123456789@slugtenant manager ali outlet1"
      : "❌ FORMAT: SETROLE 60123456789 manager ali outlet1";
    await reply(chatId, fmt);
    return res.end();
  }

  // ======================
  // PARSE ARGS
  // ======================
  let parsed;
  let tenantId;

  if (isSuperadmin) {
    parsed = parseSuperadminArgs(parts);
    if (!parsed || !parsed.phone || !parsed.slug) {
      await reply(chatId, "❌ FORMAT: SETROLE 60123456789@slugtenant manager ali outlet1");
      return res.end();
    }

    // resolve tenant from slug
    const tenant = await getTenantBySlug(parsed.slug);
    if (!tenant) {
      await reply(chatId, `❌ TENANT TAK WUJUD: ${parsed.slug}`);
      return res.end();
    }

    tenantId = tenant.id;

  } else {
    parsed = parseAdminArgs(parts);
    tenantId = user.tenant_id || null;
  }

  const { phone, role, nickname, outletNames } = parsed;

  // ======================
  // ✅ ROLE WHITELIST — block privilege escalation
  // ======================
  if (!ASSIGNABLE_ROLES.includes(role)) {
    await reply(chatId, `❌ ROLE TAK SAH: ${role}\n\nRole yang sah: ${ASSIGNABLE_ROLES.join(", ")}`);
    return res.end();
  }

  if (!isSuperadmin && (role === "admin" || role === "owner")) {
    await reply(chatId, "❌ HANYA SUPERADMIN BOLEH SET ROLE ADMIN/OWNER");
    return res.end();
  }

  // ======================
  // GET OUTLETS (scoped to resolved tenant)
  // ======================
  const { data: outlets, error } = await getAllOutlets(tenantId);

  if (error) {
    await reply(chatId, "❌ ERROR OUTLET");
    return res.end();
  }

  const matched = outletNames.map(name =>
    outlets.find(o => o.name.toLowerCase() === name.trim().toLowerCase())
  );

  if (matched.some(m => !m)) {
    await reply(chatId, "❌ ADA OUTLET TAK WUJUD");
    return res.end();
  }

  const outletIds = matched.map(m => m.id);

  // ======================
  // ROLE OUTLET VALIDATION
  // ======================
  if ((role === "staff" || role === "supervisor") && outletIds.length > 1) {
    await reply(chatId, "❌ STAFF dan SUPERVISOR hanya boleh 1 outlet");
    return res.end();
  }

  // ======================
  // CHECK USER LIMIT
  // ======================
  const limitCheck = await checkUserLimit(tenantId);

  if (!limitCheck.allowed) {
    if (limitCheck.reason === "LIMIT_REACHED") {
      await reply(chatId, `❌ HAD USER DICAPAI\n\nPlan semasa: ${limitCheck.max} user\nAktif: ${limitCheck.current}\n\nHubungi admin untuk upgrade plan.`);
    } else {
      await reply(chatId, "❌ TENANT TIDAK DIJUMPAI");
    }
    return res.end();
  }

  // ======================
  // UPSERT USER
  // ======================
  // auto-set PIN untuk admin/owner baru
  let pinUpdate = {};
  if (role === "admin" || role === "owner") {
    const bcrypt = require("bcrypt");
    const hash   = await bcrypt.hash("123456", 10);
    pinUpdate    = { dashboard_pin_hash: hash, pin_must_change: true };
  }

  // upsert terus guna supabase sebab upsertUser() tak support extra fields
  const { error: upsertError } = await supabase
    .from("users")
    .upsert({
      chat_id:   phone,
      role,
      nickname,
      outlet_id: (role === "staff" || role === "supervisor") ? outletIds[0] : null,
      is_active: true,
      tenant_id: tenantId,
      ...pinUpdate
    }, { onConflict: "chat_id" });

  if (upsertError) {
    await reply(chatId, "❌ ERROR SET ROLE");
    return res.end();
  }

  // ======================
  // MANAGE OUTLET LINKS
  // ======================
  if (role === "manager") {
    const existingIds = await getUserOutletIds(phone);
    const newIds = outletIds.filter(id => !existingIds.includes(id));
    if (newIds.length) {
      await insertUserOutlets(phone, newIds);
    }
  } else {
    await clearUserOutlets(phone);
  }

  // ======================
  // NOTIFY
  // ======================
  const tenantLabel = isSuperadmin ? ` [${parsed.slug}]` : "";
  await reply(chatId, `✅ ${nickname} set sebagai ${role}${tenantLabel}`);

  const guide = getRoleGuide(role);
  if (guide) await reply(phone, guide);

  return res.end();
});