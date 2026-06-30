const ExcelJS = require("exceljs");
const { getDeadReport } = require("../reportService");
const { toProperCase } = require("../../utils/helpers");
const { ensureExportsBucket, uploadAndSign, getLastMonthWindow, sanitizeSheetName } = require("./storage");

const BUCKETS = [
  { label: "TIDAK PERNAH DIREKOD", test: r => r.neverMoved },
  { label: "90+ HARI",             test: r => !r.neverMoved && r.daysSince >= 90 },
  { label: "60-89 HARI",           test: r => !r.neverMoved && r.daysSince >= 60 && r.daysSince < 90 },
  { label: "30-59 HARI",           test: r => !r.neverMoved && r.daysSince >= 30 && r.daysSince < 60 }
];

function addDeadSheet(workbook, outletName, rows, asOfDate) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(outletName));
  const B     = 2;

  sheet.getCell(2, B).value     = "DEAD STOCK REPORT";
  sheet.getCell(2, B).font      = { bold: true, size: 12 };
  sheet.getCell(2, B + 2).value = `AS OF ${asOfDate}`;
  sheet.getCell(3, B).value     = toProperCase(outletName);

  const dead = rows.filter(r => r.neverMoved || r.daysSince >= 30);
  let row = 5;

  if (!dead.length) {
    sheet.getCell(row, B).value = "✓ Tiada dead stock";
    return;
  }

  BUCKETS.forEach(bucket => {
    const items = dead.filter(bucket.test);
    if (!items.length) return;

    sheet.getCell(row, B).value = `${bucket.label} (${items.length} item)`;
    sheet.getCell(row, B).font  = { bold: true };
    row++;

    sheet.getCell(row, B).value     = "ITEM";
    sheet.getCell(row, B).font      = { bold: true };
    sheet.getCell(row, B + 1).value = "HARI";
    sheet.getCell(row, B + 1).font  = { bold: true };
    row++;

    items.forEach(i => {
      sheet.getCell(row, B).value     = toProperCase(i.name);
      sheet.getCell(row, B + 1).value = i.neverMoved ? "-" : i.daysSince;
      row++;
    });

    row++;
  });

  row++;
  sheet.getCell(row, B).value     = "TOTAL DEAD STOCK";
  sheet.getCell(row, B).font      = { bold: true };
  sheet.getCell(row, B + 1).value = dead.length;
  sheet.getCell(row, B + 1).font  = { bold: true };

  sheet.columns = [{ width: 5 }, { width: 28 }, { width: 12 }];
}

async function exportDead({ outletIds, tenantId, chatId }) {
  const win = getLastMonthWindow();

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR" };

  const data = await getDeadReport({ outletIds, tenantId, asOfDate: win.asOfDate });
  if (data.error) return { error: "DB_ERROR" };
  if (!Object.keys(data).length) return { error: "NO_DATA" };

  const workbook = new ExcelJS.Workbook();
  Object.entries(data).forEach(([outletName, rows]) => {
    addDeadSheet(workbook, outletName, rows, win.snapshotDate);
  });

  const result = await uploadAndSign(workbook, { tenantId, chatId, reportType: "DEAD", monthSlug: win.monthSlug });
  if (result.error) return result;

  return { ok: true, url: result.url, monthName: win.monthName, monthLabel: win.monthLabel, fileName: result.fileName, sheetCount: workbook.worksheets.length };
}

module.exports = { exportDead };