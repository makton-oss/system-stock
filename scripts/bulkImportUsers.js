// scripts/bulkImportUsers.js
require("dotenv").config();

const path    = require("path");
const ExcelJS = require("exceljs");

const { getTenantBySlug }    = require("../db/tenants/getTenantBySlug");
const { getOutletByCode }    = require("../db/outlets/getOutletByCode");
const { upsertUser }         = require("../db/users/upsertUser");
const { getUserOutletIds, insertUserOutlets, clearUserOutlets } = require("../db/users/manageUserOutlets");
const { checkUserLimit }     = require("../services/tenants/checkUserLimit");
const { verifyUserInTenant } = require("../db/users/verifyUserInTenant");

// superadmin SENGAJA tak masuk sini — terlalu risky kalau via spreadsheet
const VALID_ROLES = ["staff", "supervisor", "manager", "admin", "owner"];

// ======================
// EXCEL PARSER (ExcelJS)
// Header row (row 1): phone | role | nickname | outlet
//
// outlet:
//   staff/supervisor → 1 nama outlet sahaja
//   manager          → boleh banyak, pisah koma ("outlet a,outlet b")
//                       ATAU split kat beberapa row phone sama
//   admin/owner      → boleh kosong, diabaikan
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

(async () => {

  const slug     = process.argv[2];
  const filePath = process.argv[3];
  const dryRun   = process.argv.includes("--dry-run");

  if (!slug || !filePath) {
    console.log("❌ USAGE: node scripts/bulkImportUsers.js <slug> <path-to-excel> [--dry-run]");
    process.exit(1);
  }

  // ======================
  // RESOLVE TENANT
  // ======================
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    console.log(`❌ TENANT TAK WUJUD: ${slug}`);
    process.exit(1);
  }

  const tenantId = tenant.id;

  let rawRows;
  try {
    rawRows = await parseFile(path.resolve(filePath));
  } catch (err) {
    console.log(`❌ GAGAL BACA FILE: ${err.message}`);
    process.exit(1);
  }

  if (!rawRows.length) {
    console.log("❌ FILE KOSONG / TIADA DATA ROW");
    process.exit(1);
  }

  console.log(`👥 ${dryRun ? "[DRY RUN] " : ""}VALIDATING ${rawRows.length} ROW UNTUK TENANT: ${slug}\n`);

  // ======================
  // PHASE 1A: FIELD VALIDATION + OUTLET RESOLUTION (read-only, tiada write)
  // ======================
  const outletCache = {};
  const hardErrors   = [];
  const parsedRows   = []; // { rowNum, phone, role, nickname, outletIds: [] }

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
      hardErrors.push(`ROW ${row.rowNum}: ROLE TAK SAH — "${row.role}" (guna: ${VALID_ROLES.join(", ")})`);
      continue;
    }

    const outletNames = row.outlet
      ? row.outlet.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    // ======================
    // ROLE-OUTLET RULE (sama macam setRole.js)
    // ======================
    if (role === "staff" || role === "supervisor") {

      if (outletNames.length !== 1) {
        hardErrors.push(`ROW ${row.rowNum}: ${role.toUpperCase()} MESTI ADA EXACTLY 1 OUTLET — outlet="${row.outlet}"`);
        continue;
      }

    } else if (role === "manager") {

      if (!outletNames.length) {
        hardErrors.push(`ROW ${row.rowNum}: MANAGER MESTI ADA SEKURANG-KURANGNYA 1 OUTLET`);
        continue;
      }
    }
    // admin/owner — outletNames diabaikan sepenuhnya (ikut upsertUser logic)

    const resolvedOutletIds = [];
    let outletErr = false;

    for (const name of outletNames) {

      const cacheKey = name.toLowerCase();
      let outlet = outletCache[cacheKey];

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

    parsedRows.push({
      rowNum: row.rowNum,
      phone,
      role,
      nickname,
      outletIds: resolvedOutletIds
    });
  }

  // ======================
  // PHASE 1B: DUPLICATE / CONFLICT CHECK ANTARA ROW
  // - staff/supervisor: phone ulang = AMBIGUOUS (1 outlet shj) → error
  // - phone sama tapi role lain-lain dalam satu file → error (conflicting)
  // - manager phone ulang DIBENARKAN (outlet accumulate)
  // ======================
  const phoneRoleMap = {};          // phone -> Set(role)
  const phoneSingleOutletCount = {}; // phone -> count (staff/supervisor only)

  parsedRows.forEach(r => {
    if (!phoneRoleMap[r.phone]) phoneRoleMap[r.phone] = new Set();
    phoneRoleMap[r.phone].add(r.role);

    if (r.role === "staff" || r.role === "supervisor") {
      phoneSingleOutletCount[r.phone] = (phoneSingleOutletCount[r.phone] || 0) + 1;
    }
  });

  Object.entries(phoneSingleOutletCount).forEach(([phone, count]) => {
    if (count > 1) {
      hardErrors.push(`PHONE ${phone}: DUPLICATE ROW UNTUK STAFF/SUPERVISOR (1 outlet shj — tak boleh ulang)`);
    }
  });

  Object.entries(phoneRoleMap).forEach(([phone, roles]) => {
    if (roles.size > 1) {
      hardErrors.push(`PHONE ${phone}: ROLE BERCANGGAH DALAM FILE — ${[...roles].join(", ")}`);
    }
  });

  // ======================
  // ABORT KALAU ADA HARD ERROR — tiada apa-apa ditulis ke DB
  // ======================
  if (hardErrors.length) {
    console.log("❌ VALIDATION FAILED — TIADA APA-APA DITULIS KE DB:\n");
    hardErrors.forEach(e => console.log("  " + e));
    console.log(`\n${hardErrors.length} error dari ${rawRows.length} row. Betulkan file dan run semula.`);
    process.exit(1);
  }

  // ======================
  // PHASE 1C: GROUP BY PHONE (manager multi-row outlet accumulate)
  // ======================
  const grouped = new Map();

  parsedRows.forEach(r => {
    if (!grouped.has(r.phone)) {
      grouped.set(r.phone, {
        phone: r.phone,
        role: r.role,
        nickname: r.nickname,
        outletIds: new Set(),
        rowNums: []
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

  console.log(`✅ SEMUA ${parsedRows.length} ROW VALID → ${finalUsers.length} UNIQUE USER.\n`);

  if (dryRun) {
    console.log("[DRY RUN] Tiada apa-apa ditulis ke DB. Buang --dry-run untuk execute sebenar.\n");
    finalUsers.forEach(u => {
      console.log(`  ROW[${u.rowNums.join(",")}] ${u.phone} | ${u.role} | ${u.nickname} | outlets: ${u.outletIds.length}`);
    });
    process.exit(0);
  }

  // ======================
  // PHASE 2: EXECUTE
  // ======================
  let created      = 0;
  let updated       = 0;
  let skippedLimit = 0;
  let failed        = 0;

  for (const u of finalUsers) {

    // existing user (ANY status) — tak kena limit check, sebab tak nambah total active count
    const existing = await verifyUserInTenant(u.phone, tenantId);

    if (!existing) {
      const limitCheck = await checkUserLimit(tenantId);
      if (!limitCheck.allowed) {
        console.log(`⏭️ ROW[${u.rowNums.join(",")}] SKIP — HAD USER DICAPAI: ${u.phone} (${limitCheck.current}/${limitCheck.max})`);
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
      console.log(`❌ ROW[${u.rowNums.join(",")}] FAILED — ${u.phone}: ${upsertError.message || upsertError}`);
      failed++;
      continue;
    }

    // ======================
    // OUTLET LINKS — manager guna outlet_access, role lain di-clear
    // ======================
    if (u.role === "manager") {
      const existingIds = await getUserOutletIds(u.phone);
      const newIds = u.outletIds.filter(id => !existingIds.includes(id));
      if (newIds.length) {
        await insertUserOutlets(u.phone, newIds);
      }
    } else {
      await clearUserOutlets(u.phone);
    }

    if (existing) {
      console.log(`🔄 ROW[${u.rowNums.join(",")}] UPDATED — ${u.nickname} (${u.phone}) → ${u.role}`);
      updated++;
    } else {
      console.log(`✅ ROW[${u.rowNums.join(",")}] CREATED — ${u.nickname} (${u.phone}) → ${u.role}`);
      created++;
    }
  }

  console.log("\n======================");
  console.log(`DONE: ${created} created | ${updated} updated | ${skippedLimit} skipped (limit) | ${failed} failed`);
  console.log("======================");

  process.exit(0);

})().catch(err => {
  console.log("❌ UNEXPECTED ERROR:", err);
  process.exit(1);
});