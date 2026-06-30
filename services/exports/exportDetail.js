const ExcelJS = require("exceljs");
const { getDetailReport } = require("../reportService");
const { toProperCase } = require("../../utils/helpers");
const { ensureExportsBucket, uploadAndSign, getLastMonthWindow, sanitizeSheetName } = require("./storage");

function addDetailSheet(workbook, outletName, rows, monthLabel) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(outletName));
  const B     = 2;

  sheet.getCell(2, B).value     = "DETAIL REPORT";
  sheet.getCell(2, B).font      = { bold: true, size: 12 };
  sheet.getCell(2, B + 2).value = monthLabel;
  sheet.getCell(3, B).value     = toProperCase(outletName);

  let row = 5;
  ["ITEM", "IN", "OUT", "WASTAGE", "BALANCE"].forEach((h, i) => {
    const c = sheet.getCell(row, B + i);
    c.value = h;
    c.font  = { bold: true };
  });
  row++;

  const totals = { in: 0, out: 0, wastage: 0, bal: 0 };

  rows.forEach(r => {
    sheet.getCell(row, B).value     = toProperCase(r.name);
    sheet.getCell(row, B + 1).value = r.in;
    sheet.getCell(row, B + 2).value = r.out;
    sheet.getCell(row, B + 3).value = r.wastage;
    sheet.getCell(row, B + 4).value = r.bal;
    totals.in      += r.in;
    totals.out     += r.out;
    totals.wastage += r.wastage;
    totals.bal     += r.bal;
    row++;
  });

  ["TOTAL", totals.in, totals.out, totals.wastage, totals.bal].forEach((val, i) => {
    const c = sheet.getCell(row, B + i);
    c.value = val;
    c.font  = { bold: true };
  });

  sheet.columns = [
    { width: 5  },
    { width: 25 },
    { width: 10 }, { width: 10 }, { width: 12 }, { width: 12 }
  ];
}

async function exportDetail({ outletIds, tenantId, chatId }) {
  const win = getLastMonthWindow();

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR" };

  const data = await getDetailReport({ start: win.start, end: win.end, outletIds, tenantId });
  if (data.error) return { error: "DB_ERROR" };

  const workbook = new ExcelJS.Workbook();
  Object.entries(data).forEach(([outletName, rows]) => {
    if (rows?.length) addDetailSheet(workbook, outletName, rows, win.monthLabel);
  });

  if (!workbook.worksheets.length) return { error: "NO_DATA" };

  const result = await uploadAndSign(workbook, { tenantId, chatId, reportType: "DETAIL", monthSlug: win.monthSlug });
  if (result.error) return result;

  return { ok: true, url: result.url, monthName: win.monthName, monthLabel: win.monthLabel, fileName: result.fileName, sheetCount: workbook.worksheets.length };
}

module.exports = { exportDetail };