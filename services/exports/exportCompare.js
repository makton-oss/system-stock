const ExcelJS = require("exceljs");
const { getOwnerReport } = require("../reports/ownerSummary");
const { toProperCase } = require("../../utils/helpers");
const { ensureExportsBucket, uploadAndSign, getLastMonthWindow, sanitizeSheetName } = require("./storage");

function trendStr(pct) {
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "▬";
  return `${arrow} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function addCompareSheet(workbook, data, label, sheetMonth) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(`${sheetMonth} vs PREV`));
  const B     = 2;

  sheet.getCell(2, B).value     = "COMPARE REPORT";
  sheet.getCell(2, B).font      = { bold: true, size: 12 };
  sheet.getCell(2, B + 2).value = label;

  const sections = [
    { label: "STOCK IN",   curr: "stockIn",  prev: "prevStockIn",  change: "inChange"      },
    { label: "STOCK USED", curr: "stockOut", prev: "prevStockOut", change: "outChange"     },
    { label: "WASTAGE",    curr: "wastage",  prev: "prevWastage",  change: "wastageChange" }
  ];

  let row = 4;

  sections.forEach(sec => {
    sheet.getCell(row, B).value = sec.label;
    sheet.getCell(row, B).font  = { bold: true };
    row++;

    ["OUTLET", "SEMASA (RM)", "LEPAS (RM)", "PERUBAHAN %"].forEach((h, i) => {
      const c = sheet.getCell(row, B + i);
      c.value = h;
      c.font  = { bold: true };
    });
    row++;

    data.forEach(o => {
      sheet.getCell(row, B).value      = toProperCase(o.outletName);
      sheet.getCell(row, B + 1).value  = o[sec.curr] ?? 0;
      sheet.getCell(row, B + 1).numFmt = "#,##0.00";
      sheet.getCell(row, B + 2).value  = o[sec.prev] ?? 0;
      sheet.getCell(row, B + 2).numFmt = "#,##0.00";
      sheet.getCell(row, B + 3).value  = trendStr(o[sec.change] ?? 0);
      row++;
    });

    row++;
  });

  // Wastage % section
  row++;
  sheet.getCell(row, B).value = "WASTAGE % PERFORMANCE";
  sheet.getCell(row, B).font  = { bold: true };
  row++;

  ["OUTLET", "WASTAGE %"].forEach((h, i) => {
    const c = sheet.getCell(row, B + i);
    c.value = h;
    c.font  = { bold: true };
  });
  row++;

  data.forEach(o => {
    sheet.getCell(row, B).value     = toProperCase(o.outletName);
    sheet.getCell(row, B + 1).value = `${(o.wastagePercent ?? 0).toFixed(1)}%`;
    row++;
  });

  sheet.columns = [
    { width: 5  },
    { width: 22 }, { width: 16 }, { width: 16 }, { width: 16 }
  ];
}

async function exportCompare({ outletIds, tenantId, chatId }) {
  const win = getLastMonthWindow();

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR" };

  const { data, label, error } = await getOwnerReport({
    mode:       "monthly",
    monthInput: win.monthInput,
    outletIds,
    tenantId
  });

  if (error) return { error: "DB_ERROR" };
  if (!data?.length) return { error: "NO_DATA" };

  const workbook = new ExcelJS.Workbook();
  addCompareSheet(workbook, data, label, win.sheetMonth);

  const result = await uploadAndSign(workbook, { tenantId, chatId, reportType: "COMPARE", monthSlug: win.monthSlug });
  if (result.error) return result;

  return { ok: true, url: result.url, monthName: win.monthName, monthLabel: win.monthLabel, label, fileName: result.fileName, sheetCount: 1 };
}

module.exports = { exportCompare };