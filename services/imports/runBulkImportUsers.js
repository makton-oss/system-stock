const ExcelJS = require("exceljs");
const { getTenantBySlug }    = require("../../db/tenants/getTenantBySlug");
const { getOutletByCode }    = require("../../db/outlets/getOutletByCode");
const { upsertUser }         = require("../../db/users/upsertUser");
const { getUserOutletIds, insertUserOutlets, clearUserOutlets } = require("../../db/users/manageUserOutlets");
const { checkUserLimit }     = require("../tenants/checkUserLimit");
const { verifyUserInTenant } = require("../../db/users/verifyUserInTenant");

// superadmin sengaja tak disertakan — too risky via file upload
const VALID_ROLES = ["staff", "supervisor", "manager", "admin", "owner"];

// ======================
// PARSE EXCEL
// Header: phone | role | nickname | outlet
// outlet: boleh koma-separated untuk manager
// ======================
async function parseFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headerMap = {};

  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value ?? "").toLowerCase().trim();
    if (key) headerMap[colNumber] = key;
  });

  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const normalized = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headerMap[colNumber];
      if (key) normalized[key] = cell.value;
    });

    const hasAnyValue = Object.values(normalized).some(
      v => v !== null && v !== undefined && String(v).trim() !== ""
    );
    if (!hasAnyValue) return;

    rows.push({
      rowNum:   rowNumber,
      phone:    String(normalized.phone    ?? "").trim(),
      role:     String(normalized.role     ?? "").trim().toLowerCase(),
      nickname: String(normalized.nickname ?? "").trim(),
      outlet:   String(normalized.outlet   ?? "").trim()
    });
  });

  return rows;
}

// ======================
// MAIN EXPORT
// ======================
async function runBulkImportUsers({ slug, filePath, dryRun = false }) {

  const logs = [];
  const log  = (msg) => { console.log(msg); logs.push(msg); };

  // ── RESOLVE TENANT ──
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: `TENANT TAK WUJUD: ${slug}`, logs };

  const tenantId = tenant.id;

  // ── PARSE FILE ──
  let rawRows;
  try {
    rawRows = await parseFile(filePath);
  } catch (err) {
    return { ok: false, error: `GAGAL BACA FILE: ${err.message}`, logs };
  }

  if (!rawRows.length) {
    return { ok: false, error: "FILE KOSONG / TIADA DATA ROW", logs };
  }

  log(`👥 ${dryRun ? "[DRY RUN] " : ""}VALIDATING ${rawRows.length} ROW UNTUK TENANT: ${slug}`);

  // ── PHASE 1A: FIELD VALIDATION + OUTLET RESOLUTION ──
  const outletCache = {};
  const hardErrors  = [];
  const parsedRows  = [];

  for (const row of rawRows) {
    const phone    = row.phone.replace(/[^\d]/g, "");
    const role     = row.role;
    const nickname = row.nickname;

    if (!phone || !role || !nickname) {
      hardErrors.push(
        `ROW ${row.rowNum}: DATA TAK LENGKAP — phone="${row.phone}" role="${row.role}" nickname="${row.nickname}"`
      );
      continue;
    }

    if (!VALID_ROLES.includes(role)) {
      hardErrors.push(
        `ROW ${row.rowNum}: ROLE TAK SAH — "${row.role}" (guna: ${VALID_ROLES.join(", ")})`
      );
      continue;
    }

    const outletNames = row.outlet
      ? row.outlet.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    // Role-outlet rules (sama macam setRole handler)
    if (role === "staff" || role === "supervisor") {
      if (outletNames.length !== 1) {
        hardErrors.push(
          `ROW ${row.rowNum}: ${role.toUpperCase()} MESTI ADA EXACTLY 1 OUTLET — outlet="${row.outlet}"`
        );
        continue;
      }
    } else if (role === "manager") {
      if (!outletNames.length) {
        hardErrors.push(`ROW ${row.rowNum}: MANAGER MESTI ADA SEKURANG-KURANGNYA 1 OUTLET`);
        continue;
      }
    }
    // admin/owner — outlet diabaikan

    const resolvedOutletIds = [];
    let outletErr = false;

    for (const name of outletNames) {
      const cacheKey = name.toLowerCase();
      let outlet     = outletCache[cacheKey];

      if (!outlet) {
        outlet = await getOutletByCode(name, tenantId);
        if (outlet) outletCache[cacheKey] = outlet;
      }

      if (!outlet) {
        hardErrors.push(`ROW ${row.rowNum}: OUTLET TAK WUJUD — "${name}"`);
        outletErr = true;
        break;
      }

      resolvedOutletIds.push(outlet.id);
    }

    if (outletErr) continue;

    parsedRows.push({ rowNum: row.rowNum, phone, role, nickname, outletIds: resolvedOutletIds });
  }

  // ── PHASE 1B: DUPLICATE / CONFLICT CHECK ──
  const phoneRoleMap           = {};
  const phoneSingleOutletCount = {};

  parsedRows.forEach(r => {
    if (!phoneRoleMap[r.phone]) phoneRoleMap[r.phone] = new Set();
    phoneRoleMap[r.phone].add(r.role);

    if (r.role === "staff" || r.role === "supervisor") {
      phoneSingleOutletCount[r.phone] = (phoneSingleOutletCount[r.phone] || 0) + 1;
    }
  });

  Object.entries(phoneSingleOutletCount).forEach(([phone, count]) => {
    if (count > 1) {
      hardErrors.push(`PHONE ${phone}: DUPLICATE ROW UNTUK STAFF/SUPERVISOR (1 outlet shj)`);
    }
  });

  Object.entries(phoneRoleMap).forEach(([phone, roles]) => {
    if (roles.size > 1) {
      hardErrors.push(`PHONE ${phone}: ROLE BERCANGGAH DALAM FILE — ${[...roles].join(", ")}`);
    }
  });

  // ── ABORT ON HARD ERRORS ──
  if (hardErrors.length) {
    log("❌ VALIDATION FAILED — TIADA APA-APA DITULIS KE DB");
    hardErrors.forEach(e => log("  " + e));
    return { ok: false, error: "VALIDATION_FAILED", hardErrors, logs };
  }

  // ── PHASE 1C: GROUP BY PHONE (manager multi-outlet accumulate) ──
  const grouped = new Map();

  parsedRows.forEach(r => {
    if (!grouped.has(r.phone)) {
      grouped.set(r.phone, {
        phone:     r.phone,
        role:      r.role,
        nickname:  r.nickname,
        outletIds: new Set(),
        rowNums:   []
      });
    }
    const g = grouped.get(r.phone);
    r.outletIds.forEach(id => g.outletIds.add(id));
    g.rowNums.push(r.rowNum);
  });

  const finalUsers = [...grouped.values()].map(g => ({
    ...g,
    outletIds: [...g.outletIds]
  }));

  log(`✅ SEMUA ${parsedRows.length} ROW VALID → ${finalUsers.length} UNIQUE USER.`);

  if (dryRun) {
    return { ok: true, dryRun: true, validCount: finalUsers.length, logs };
  }

  // ── PHASE 2: EXECUTE ──
  let created = 0, updated = 0, skippedLimit = 0, failed = 0;

  for (const u of finalUsers) {

    // Existing user tak kena limit check (tak tambah active count)
    const existing = await verifyUserInTenant(u.phone, tenantId);

    if (!existing) {
      const limitCheck = await checkUserLimit(tenantId);
      if (!limitCheck.allowed) {
        log(`⏭️ ROW[${u.rowNums.join(",")}] SKIP — HAD USER DICAPAI: ${u.phone} (${limitCheck.current}/${limitCheck.max})`);
        skippedLimit++;
        continue;
      }
    }

    const outletId = (u.role === "staff" || u.role === "supervisor")
      ? u.outletIds[0]
      : null;

    const { error: upsertError } = await upsertUser({
      phone:    u.phone,
      role:     u.role,
      nickname: u.nickname,
      outletId,
      tenantId
    });

    if (upsertError) {
      log(`❌ ROW[${u.rowNums.join(",")}] FAILED — ${u.phone}: ${upsertError.message || upsertError}`);
      failed++;
      continue;
    }

    // Manage outlet_access links
    if (u.role === "manager") {
      const existingIds = await getUserOutletIds(u.phone);
      const newIds      = u.outletIds.filter(id => !existingIds.includes(id));
      if (newIds.length) await insertUserOutlets(u.phone, newIds);
    } else {
      await clearUserOutlets(u.phone);
    }

    if (existing) {
      log(`🔄 ROW[${u.rowNums.join(",")}] UPDATED — ${u.nickname} (${u.phone}) → ${u.role}`);
      updated++;
    } else {
      log(`✅ ROW[${u.rowNums.join(",")}] CREATED — ${u.nickname} (${u.phone}) → ${u.role}`);
      created++;
    }
  }

  log(`DONE: ${created} created | ${updated} updated | ${skippedLimit} skipped (limit) | ${failed} failed`);

  return { ok: true, dryRun: false, created, updated, skippedLimit, failed, logs };
}

module.exports = { runBulkImportUsers };