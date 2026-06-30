const ExcelJS = require("exceljs");
const { getInventoryDetailByOutlet } = require("../reports/inventoryDetail");
const { getOutletById } = require("../../db/outlets/getOutletById");
const { toProperCase } = require("../../utils/helpers");
const { ensureExportsBucket, uploadAndSign, getLastMonthWindow, sanitizeSheetName } = require("./storage");

// Layout: 3 blocks per row, each block = 5 cols + 1 gap col
const BLOCKS_PER_ROW = 3;
const BLOCK_STEP     = 6; // 5 data + 1 gap

function groupByCategory(items) {
  const map = new Map();
  items.forEach(i => {
    if (!map.has(i.category)) map.set(i.category, []);
    map.get(i.category).push(i);
  });
  return [...map.keys()].sort().map(cat => [cat, map.get(cat)]);
}

function writeBlock(sheet, startRow, startCol, categoryName, items) {
  sheet.getCell(startRow, startCol).value = toProperCase(categoryName);
  sheet.getCell(startRow, startCol).font  = { bold: true };

  const hRow = startRow + 1;
  ["UOM", "PRICE (RM)", "QTY", "TOTAL (RM)"].forEach((label, i) => {
    const c = sheet.getCell(hRow, startCol + 1 + i);
    c.value = label;
    c.font  = { bold: true };
  });

  let row = hRow + 1;
  let subtotal = 0;

  items.forEach(item => {
    sheet.getCell(row, startCol).value          = toProperCase(item.name);
    sheet.getCell(row, startCol + 1).value      = item.uom;
    sheet.getCell(row, startCol + 2).value      = item.price;
    sheet.getCell(row, startCol + 2).numFmt     = "#,##0.00";
    sheet.getCell(row, startCol + 3).value      = item.qty;
    sheet.getCell(row, startCol + 4).value      = item.total;
    sheet.getCell(row, startCol + 4).numFmt     = "#,##0.00";
    subtotal += item.total;
    row++;
  });

  sheet.getCell(row, startCol).value          = "TOTAL (RM)";
  sheet.getCell(row, startCol).font           = { bold: true };
  sheet.getCell(row, startCol + 4).value      = subtotal;
  sheet.getCell(row, startCol + 4).numFmt     = "#,##0.00";
  sheet.getCell(row, startCol + 4).font       = { bold: true };

  return { endRow: row, subtotal };
}

function addInventorySheet(workbook, { outletName, items, monthLabel, sheetMonth }) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(outletName));
  const B     = 2;

  sheet.getCell(2, B).value       = "INVENTORY REPORT";
  sheet.getCell(2, B).font        = { bold: true, size: 12 };
  sheet.getCell(2, B + 2).value   = monthLabel;
  sheet.getCell(3, B).value       = toProperCase(outletName);

  const grouped  = groupByCategory(items);
  let sectionTop = 5;
  let grandTotal = 0;

  for (let i = 0; i < grouped.length; i += BLOCKS_PER_ROW) {
    const rowBlocks = grouped.slice(i, i + BLOCKS_PER_ROW);
    let maxEndRow   = sectionTop;

    rowBlocks.forEach(([category, catItems], idx) => {
      const col = B + idx * BLOCK_STEP;
      const { endRow, subtotal } = writeBlock(sheet, sectionTop, col, category, catItems);
      grandTotal += subtotal;
      if (endRow > maxEndRow) maxEndRow = endRow;
    });

    sectionTop = maxEndRow + 2;
  }

  sheet.getCell(sectionTop, B).value          = "TOTAL AMOUNT (ALL):";
  sheet.getCell(sectionTop, B).font           = { bold: true };
  sheet.getCell(sectionTop, B + 1).value      = grandTotal;
  sheet.getCell(sectionTop, B + 1).numFmt     = "#,##0.00";
  sheet.getCell(sectionTop, B + 1).font       = { bold: true };

  // col widths: A, B(name), C(uom), D(price), E(qty), F(total), G(gap), repeat x3
  sheet.columns = [
    { width: 5  },
    { width: 22 }, { width: 8 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 3 },
    { width: 22 }, { width: 8 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 3 },
    { width: 22 }, { width: 8 }, { width: 12 }, { width: 8 }, { width: 14 }
  ];
}

async function exportInventory({ outletIds, tenantId, chatId }) {
  const win = getLastMonthWindow();

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR" };

  const workbook      = new ExcelJS.Workbook();
  const noDataOutlets = [];

  for (const outletId of outletIds) {
    const outlet = await getOutletById(outletId, tenantId);
    if (!outlet) continue;

    const { items, error } = await getInventoryDetailByOutlet({
      outletId,
      snapshotDate: win.snapshotDate,
      tenantId
    });

    if (error || !items?.length) {
      noDataOutlets.push(outlet.name);
      continue;
    }

    addInventorySheet(workbook, {
      outletName: outlet.name,
      items,
      monthLabel: win.monthLabel,
      sheetMonth: win.sheetMonth
    });
  }

  if (!workbook.worksheets.length) return { error: "NO_SNAPSHOT", noDataOutlets };

  const result = await uploadAndSign(workbook, {
    tenantId, chatId,
    reportType: "INVENTORY",
    monthSlug:  win.monthSlug
  });

  if (result.error) return result;

  return {
    ok: true,
    url:          result.url,
    monthName:    win.monthName,
    monthLabel:   win.monthLabel,
    fileName:     result.fileName,
    sheetCount:   workbook.worksheets.length,
    noDataOutlets
  };
}

module.exports = { exportInventory };