const ExcelJS = require("exceljs");
const { getSummaryReport } = require("../reports/summaryReport");
const { toProperCase } = require("../../utils/helpers");
const { ensureExportsBucket, uploadAndSign, getLastMonthWindow, sanitizeSheetName } = require("./storage");

function addSummarySheet(workbook, outlet, monthLabel) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(outlet.outletName));
  const B     = 2;

  sheet.getCell(2, B).value     = "MONTHLY SUMMARY REPORT";
  sheet.getCell(2, B).font      = { bold: true, size: 12 };
  sheet.getCell(2, B + 2).value = monthLabel;
  sheet.getCell(3, B).value     = toProperCase(outlet.outletName);

  let row = 5;
  sheet.getCell(row, B).value = "STOCK FLOW";
  sheet.getCell(row, B).font  = { bold: true };
  row++;

  const flowData = [
    ["Opening Stock (RM)", outlet.openingValue, false],
    ["Stock In (RM)",      outlet.stockIn,      false],
    ["Stock Used (RM)",    outlet.stockOut,      false],
    ["Wastage (RM)",       outlet.wastage,       false],
    ["Closing Stock (RM)", outlet.closingValue,  false],
    ["Wastage %",          outlet.wastagePercent, true]
  ];

  flowData.forEach(([label, val, isPct]) => {
    sheet.getCell(row, B).value = label;
    if (val === null || val === undefined) {
      sheet.getCell(row, B + 1).value = "(tiada snapshot)";
    } else if (isPct) {
      sheet.getCell(row, B + 1).value  = val / 100;
      sheet.getCell(row, B + 1).numFmt = "0.0%";
    } else {
      sheet.getCell(row, B + 1).value  = val;
      sheet.getCell(row, B + 1).numFmt = "#,##0.00";
    }
    row++;
  });

  row++;

  const CU = B;
  const CW = B + 3;

  sheet.getCell(row, CU).value = "TOP USAGE (TOP 5)";
  sheet.getCell(row, CU).font  = { bold: true };
  sheet.getCell(row, CW).value = "TOP WASTAGE (TOP 5)";
  sheet.getCell(row, CW).font  = { bold: true };
  row++;

  [CU, CW].forEach(col => {
    sheet.getCell(row, col).value     = "ITEM";
    sheet.getCell(row, col).font      = { bold: true };
    sheet.getCell(row, col + 1).value = "RM";
    sheet.getCell(row, col + 1).font  = { bold: true };
  });
  row++;

  const maxRows = Math.max(outlet.topUsage?.length || 0, outlet.topWastage?.length || 0, 1);

  for (let i = 0; i < maxRows; i++) {
    const [uItem, uVal] = outlet.topUsage?.[i]    || ["-", 0];
    const [wItem, wVal] = outlet.topWastage?.[i]  || ["-", 0];

    sheet.getCell(row, CU).value      = toProperCase(uItem);
    sheet.getCell(row, CU + 1).value  = uVal ?? 0;
    sheet.getCell(row, CU + 1).numFmt = "#,##0.00";
    sheet.getCell(row, CW).value      = toProperCase(wItem);
    sheet.getCell(row, CW + 1).value  = wVal ?? 0;
    sheet.getCell(row, CW + 1).numFmt = "#,##0.00";
    row++;
  }

  sheet.columns = [
    { width: 5  },
    { width: 22 }, { width: 16 }, { width: 5 },
    { width: 22 }, { width: 16 }
  ];
}

async function exportSummary({ outletIds, tenantId, chatId }) {
  const win = getLastMonthWindow();

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR" };

  const data = await getSummaryReport({ start: win.start, end: win.end, outletIds, tenantId });
  if (data.error) return { error: "DB_ERROR" };
  if (!data?.length) return { error: "NO_DATA" };

  const workbook = new ExcelJS.Workbook();
  data.forEach(outlet => addSummarySheet(workbook, outlet, win.monthLabel));

  const result = await uploadAndSign(workbook, {
    tenantId, chatId,
    reportType: "SUMMARY",
    monthSlug:  win.monthSlug
  });

  if (result.error) return result;

  return { ok: true, url: result.url, monthName: win.monthName, monthLabel: win.monthLabel, fileName: result.fileName, sheetCount: workbook.worksheets.length };
}

module.exports = { exportSummary };