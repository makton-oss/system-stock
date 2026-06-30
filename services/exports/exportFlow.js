const ExcelJS = require("exceljs");
const { getFlowReport } = require("../reportService");
const { toProperCase } = require("../../utils/helpers");
const { ensureExportsBucket, uploadAndSign, getLastMonthWindow, sanitizeSheetName } = require("./storage");

function addFlowSheet(workbook, outletName, data, monthLabel) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(outletName));
  const B     = 2;

  sheet.getCell(2, B).value     = "FLOW REPORT";
  sheet.getCell(2, B).font      = { bold: true, size: 12 };
  sheet.getCell(2, B + 2).value = monthLabel;
  sheet.getCell(3, B).value     = toProperCase(outletName);

  let row = 5;
  sheet.getCell(row, B).value = "FLOW SUMMARY";
  sheet.getCell(row, B).font  = { bold: true };
  row++;

  [
    ["Stock In (RM)",  data.inVal],
    ["Stock Used (RM)", data.outVal],
    ["Wastage (RM)",   data.wastageVal],
    ["Net (RM)",       data.net]
  ].forEach(([label, val]) => {
    sheet.getCell(row, B).value     = label;
    sheet.getCell(row, B + 1).value = val ?? 0;
    sheet.getCell(row, B + 1).numFmt = "#,##0.00";
    row++;
  });

  row++;

  const sections = [
    { col: B,     label: "TOP 5 IN",      list: data.topIn },
    { col: B + 3, label: "TOP 5 OUT",     list: data.topOut },
    { col: B + 6, label: "TOP 5 WASTAGE", list: data.topWastage }
  ];

  sections.forEach(({ col, label }) => {
    sheet.getCell(row, col).value         = label;
    sheet.getCell(row, col).font          = { bold: true };
    sheet.getCell(row + 1, col).value     = "ITEM";
    sheet.getCell(row + 1, col).font      = { bold: true };
    sheet.getCell(row + 1, col + 1).value = "RM";
    sheet.getCell(row + 1, col + 1).font  = { bold: true };
  });

  const dataRow = row + 2;
  const maxItems = Math.max(data.topIn?.length || 0, data.topOut?.length || 0, data.topWastage?.length || 0, 1);

  for (let i = 0; i < maxItems; i++) {
    sections.forEach(({ col, list }) => {
      const [item, val] = list?.[i] || ["-", 0];
      sheet.getCell(dataRow + i, col).value       = toProperCase(item);
      sheet.getCell(dataRow + i, col + 1).value   = val ?? 0;
      sheet.getCell(dataRow + i, col + 1).numFmt  = "#,##0.00";
    });
  }

  sheet.columns = [
    { width: 5  },
    { width: 22 }, { width: 14 }, { width: 5 },
    { width: 22 }, { width: 14 }, { width: 5 },
    { width: 22 }, { width: 14 }
  ];
}

async function exportFlow({ outletIds, tenantId, chatId }) {
  const win = getLastMonthWindow();

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR" };

  const data = await getFlowReport({ start: win.start, end: win.end, outletIds, tenantId });
  if (data.error) return { error: "DB_ERROR" };
  if (!Object.keys(data).length) return { error: "NO_DATA" };

  const workbook = new ExcelJS.Workbook();
  Object.entries(data).forEach(([outletName, outletData]) => {
    addFlowSheet(workbook, outletName, outletData, win.monthLabel);
  });

  const result = await uploadAndSign(workbook, { tenantId, chatId, reportType: "FLOW", monthSlug: win.monthSlug });
  if (result.error) return result;

  return { ok: true, url: result.url, monthName: win.monthName, monthLabel: win.monthLabel, fileName: result.fileName, sheetCount: workbook.worksheets.length };
}

module.exports = { exportFlow };