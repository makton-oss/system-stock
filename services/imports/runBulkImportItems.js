const ExcelJS = require("exceljs");
const { normalizeItem }   = require("../../utils/helpers");
const { getTenantBySlug } = require("../../db/tenants/getTenantBySlug");
const { getOutletByCode } = require("../../db/outlets/getOutletByCode");
const { addStockItem }    = require("../stock/addStockItem");

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

async function runBulkImportItems({ slug, filePath, dryRun = false }) {

  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: `TENANT TAK WUJUD: ${slug}`, logs };

  const tenantId = tenant.id;

  let rawRows;
  try {
    rawRows = await parseFile(filePath);
  } catch (err) {
    return { ok: false, error: `GAGAL BACA FILE: ${err.message}`, logs };
  }

  if (!rawRows.length) {
    return { ok: false, error: "FILE KOSONG / TIADA DATA ROW", logs };
  }

  log(`📦 ${dryRun ? "[DRY RUN] " : ""}VALIDATING ${rawRows.length} ROW UNTUK TENANT: ${slug}`);

  const outletCache = {};
  const validRows   = [];
  const hardErrors  = [];

  for (const row of rawRows) {
    const item        = normalizeItem(row.item);
    const category     = row.category;
    const minQty        = parseInt(row.minQty);
    const cost            = parseFloat(row.cost);
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

  if (hardErrors.length) {
    log("❌ VALIDATION FAILED — TIADA APA-APA DITULIS KE DB");
    hardErrors.forEach(e => log("  " + e));
    return { ok: false, error: "VALIDATION_FAILED", hardErrors, logs };
  }

  log(`✅ SEMUA ${validRows.length} ROW VALID.`);

  if (dryRun) {
    return { ok: true, dryRun: true, validCount: validRows.length, logs };
  }

  let created = 0, skipped = 0, failed = 0;

  for (const row of validRows) {
    const result = await addStockItem({
      item: row.item, category: row.category, minQty: row.minQty,
      cost: row.cost, uom: row.uom, outlet: row.outlet, tenantId
    });

    if (result.error === "STOCK_EXISTS") {
      log(`⏭️ ROW ${row.rowNum} SKIP — DAH ADA: ${row.item} @ ${row.outlet.name}`);
      skipped++;
    } else if (result.error) {
      log(`❌ ROW ${row.rowNum} FAILED (${result.error}): ${row.item}`);
      failed++;
    } else {
      log(`✅ ROW ${row.rowNum} OK — ${row.item} @ ${row.outlet.name}`);
      created++;
    }
  }

  log(`DONE: ${created} created | ${skipped} skipped (dup) | ${failed} failed`);

  return { ok: true, dryRun: false, created, skipped, failed, logs };
}

module.exports = { runBulkImportItems };