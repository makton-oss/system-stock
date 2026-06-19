require("dotenv").config();

const path     = require("path");
const ExcelJS  = require("exceljs");

const { normalizeItem }   = require("../utils/helpers");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");
const { getOutletByCode } = require("../db/outlets/getOutletByCode");
const { addStockItem }    = require("../services/stock/addStockItem");

// ======================
// EXCEL PARSER (ExcelJS)
// Header row (row 1) kena ada, case/space tak kisah:
// item | category | min_qty | cost | uom | outlet
// ======================
async function parseFile(filePath) {

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  // ======================
  // BACA HEADER ROW (row 1) — normalize jadi lowercase key
  // ======================
  const headerRow = sheet.getRow(1);
  const headerMap = {}; // { colIndex: "item" }

  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value ?? "").toLowerCase().trim();
    if (key) headerMap[colNumber] = key;
  });

  const rows = [];

  // ======================
  // BACA DATA ROW (row 2 onwards)
  // ======================
  sheet.eachRow((row, rowNumber) => {

    if (rowNumber === 1) return; // skip header

    const normalized = {};

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headerMap[colNumber];
      if (key) normalized[key] = cell.value;
    });

    // skip baris kosong sepenuhnya
    const hasAnyValue = Object.values(normalized).some(
      v => v !== null && v !== undefined && String(v).trim() !== ""
    );
    if (!hasAnyValue) return;

    rows.push({
      rowNum:   rowNumber,
      item:     String(normalized.item     ?? "").trim(),
      category: String(normalized.category ?? "").trim(),
      minQty:   normalized.min_qty,
      cost:     normalized.cost,
      uom:      String(normalized.uom      ?? "").trim(),
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
    console.log("❌ USAGE: node scripts/bulkImportItems.js <slug> <path-to-excel> [--dry-run]");
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

  console.log(`📦 ${dryRun ? "[DRY RUN] " : ""}VALIDATING ${rawRows.length} ROW UNTUK TENANT: ${slug}\n`);

  // ======================
  // PHASE 1: VALIDATE (read-only, tiada write ke DB)
  // ======================
  const outletCache = {};
  const validRows   = [];
  const hardErrors   = [];

  for (const row of rawRows) {

    const item       = normalizeItem(row.item);
    const category    = row.category;
    const minQty       = parseInt(row.minQty);
    const cost           = parseFloat(row.cost);
    const uom              = row.uom;
    const outletName       = row.outlet;

    if (!item || !category || isNaN(minQty) || isNaN(cost) || !uom || !outletName) {
      hardErrors.push(
        `ROW ${row.rowNum}: DATA TAK LENGKAP/SALAH FORMAT — item="${row.item}" category="${row.category}" min_qty="${row.minQty}" cost="${row.cost}" uom="${row.uom}" outlet="${row.outlet}"`
      );
      continue;
    }

    const cacheKey = outletName.toLowerCase();
    let outlet = outletCache[cacheKey];

    if (!outlet) {
      outlet = await getOutletByCode(outletName, tenantId);
      if (outlet) outletCache[cacheKey] = outlet;
    }

    if (!outlet) {
      hardErrors.push(`ROW ${row.rowNum}: OUTLET TAK WUJUD — "${outletName}"`);
      continue;
    }

    validRows.push({ rowNum: row.rowNum, item, category, minQty, cost, uom, outlet });
  }

  // ======================
  // ABORT KALAU ADA HARD ERROR — tiada apa-apa ditulis ke DB
  // ======================
  if (hardErrors.length) {
    console.log("❌ VALIDATION FAILED — TIADA APA-APA DITULIS KE DB:\n");
    hardErrors.forEach(e => console.log("  " + e));
    console.log(`\n${hardErrors.length} error dari ${rawRows.length} row. Betulkan file dan run semula.`);
    process.exit(1);
  }

  console.log(`✅ SEMUA ${validRows.length} ROW VALID.\n`);

  if (dryRun) {
    console.log("[DRY RUN] Tiada apa-apa ditulis ke DB. Buang --dry-run untuk execute sebenar.");
    process.exit(0);
  }

  // ======================
  // PHASE 2: EXECUTE
  // ======================
  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const row of validRows) {

    const result = await addStockItem({
      item:     row.item,
      category: row.category,
      minQty:   row.minQty,
      cost:     row.cost,
      uom:      row.uom,
      outlet:   row.outlet,
      tenantId
    });

    if (result.error === "STOCK_EXISTS") {
      console.log(`⏭️ ROW ${row.rowNum} SKIP — DAH ADA: ${row.item} @ ${row.outlet.name}`);
      skipped++;
    } else if (result.error) {
      console.log(`❌ ROW ${row.rowNum} FAILED (${result.error}): ${row.item}`);
      failed++;
    } else {
      console.log(`✅ ROW ${row.rowNum} OK — ${row.item} @ ${row.outlet.name}`);
      created++;
    }
  }

  console.log("\n======================");
  console.log(`DONE: ${created} created | ${skipped} skipped (dup) | ${failed} failed`);
  console.log("======================");

  process.exit(0);

})().catch(err => {
  console.log("❌ UNEXPECTED ERROR:", err);
  process.exit(1);
});