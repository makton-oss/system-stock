const ExcelJS = require("exceljs");
const { DateTime } = require("luxon");
const supabase = require("../db");
const { ensureExportsBucket } = require("./storage");
const { getInventoryDetailByOutlet } = require("../reports/inventoryDetail");
const { toProperCase } = require("../../utils/helpers");

const BLOCKS_PER_ROW = 3;
const BLOCK_WIDTH    = 6; // 5 data col + 1 gap col
const START_COL      = 2; // column B

// ======================
// LAST MONTH WINDOW (selalu hardcoded — bukan ikut input user)
// ======================
function getLastMonthWindow() {
  const lastMonth = DateTime.now().setZone("Asia/Kuala_Lumpur").minus({ months: 1 });
  return {
    snapshotDate: lastMonth.endOf("month").toFormat("yyyy-MM-dd"),
    monthLabel:   lastMonth.toFormat("LLLL yyyy").toUpperCase(), // "MAY 2026"
    monthName:    lastMonth.toFormat("LLLL"),                    // "May"
    sheetName:    lastMonth.toFormat("LLLL").toUpperCase()
  };
}

function groupByCategory(items) {
  const map = new Map();
  items.forEach(i => {
    if (!map.has(i.category)) map.set(i.category, []);
    map.get(i.category).push(i);
  });
  // alphabetical — sama pattern macam formatStockByCategory.js
  return [...map.keys()].sort().map(cat => [cat, map.get(cat)]);
}

function writeBlock(sheet, startRow, startCol, categoryName, items) {

  sheet.getCell(startRow, startCol).value = toProperCase(categoryName);
  sheet.getCell(startRow, startCol).font  = { bold: true };

  const headerRow = startRow + 1;
  ["UOM", "PRICE (RM)", "QTY", "TOTAL (RM)"].forEach((label, i) => {
    const cell = sheet.getCell(headerRow, startCol + 1 + i);
    cell.value = label;
    cell.font  = { bold: true };
  });

  let row = headerRow + 1;
  let subtotal = 0;

  items.forEach(item => {
    sheet.getCell(row, startCol).value      = toProperCase(item.name);
    sheet.getCell(row, startCol + 1).value  = item.uom;
    sheet.getCell(row, startCol + 2).value  = item.price;
    sheet.getCell(row, startCol + 2).numFmt = "#,##0.00";
    sheet.getCell(row, startCol + 3).value  = item.qty;
    sheet.getCell(row, startCol + 4).value  = item.total;
    sheet.getCell(row, startCol + 4).numFmt = "#,##0.00";
    subtotal += item.total;
    row++;
  });

  sheet.getCell(row, startCol).value      = "TOTAL (RM)";
  sheet.getCell(row, startCol).font       = { bold: true };
  sheet.getCell(row, startCol + 4).value  = subtotal;
  sheet.getCell(row, startCol + 4).numFmt = "#,##0.00";
  sheet.getCell(row, startCol + 4).font   = { bold: true };

  return { endRow: row, subtotal };
}

function buildInventoryWorkbook({ outlet, items, monthLabel, sheetName }) {

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.getCell(2, START_COL).value     = "INVENTORY REPORT";
  sheet.getCell(2, START_COL).font      = { bold: true, size: 12 };
  sheet.getCell(2, START_COL + 2).value = monthLabel;
  sheet.getCell(3, START_COL).value     = toProperCase(outlet.name);

  const grouped = groupByCategory(items);

  let grandTotal    = 0;
  let sectionTopRow = 5;

  for (let i = 0; i < grouped.length; i += BLOCKS_PER_ROW) {

    const rowBlocks = grouped.slice(i, i + BLOCKS_PER_ROW);
    let tallestEndRow = sectionTopRow;

    rowBlocks.forEach(([category, catItems], idx) => {
      const col = START_COL + idx * BLOCK_WIDTH;
      const { endRow, subtotal } = writeBlock(sheet, sectionTopRow, col, category, catItems);
      grandTotal += subtotal;
      tallestEndRow = Math.max(tallestEndRow, endRow);
    });

    sectionTopRow = tallestEndRow + 2; // gap row sebelum section seterusnya
  }

  sheet.getCell(sectionTopRow, START_COL).value      = "TOTAL AMOUNT (ALL):";
  sheet.getCell(sectionTopRow, START_COL).font       = { bold: true };
  sheet.getCell(sectionTopRow, START_COL + 1).value  = grandTotal;
  sheet.getCell(sectionTopRow, START_COL + 1).numFmt = "#,##0.00";
  sheet.getCell(sectionTopRow, START_COL + 1).font   = { bold: true };

  sheet.columns.forEach(col => { col.width = 16; });

  return workbook;
}

async function exportInventoryForOutlet({ outlet, tenantId }) {

  const { snapshotDate, monthLabel, monthName, sheetName } = getLastMonthWindow();

  const { items, error } = await getInventoryDetailByOutlet({
    outletId: outlet.id,
    snapshotDate,
    tenantId
  });

  if (error) return { error: "DB_ERROR", outletName: outlet.name };
  if (!items?.length) return { error: "NO_SNAPSHOT", outletName: outlet.name };

  const workbook = buildInventoryWorkbook({ outlet, items, monthLabel, sheetName });

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR", outletName: outlet.name };

  const buffer = await workbook.xlsx.writeBuffer();

  // filename ikut format yang diminta: "Inventory Report May NTP"
  const fileLabel  = `Inventory Report ${monthName} ${outlet.name}`.trim();
  const safeFile   = fileLabel.replace(/[^a-zA-Z0-9 _-]/g, "");
  const fileName   = `${safeFile}.xlsx`;
  const storagePath = `${tenantId || "global"}/${snapshotDate.slice(0, 7)}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("exports")
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true
    });

  if (uploadError) {
    console.log("EXPORT UPLOAD ERROR:", uploadError);
    return { error: "UPLOAD_ERROR", outletName: outlet.name };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("exports")
    .createSignedUrl(storagePath, 3600); // 1 jam

  if (signError) {
    console.log("EXPORT SIGN URL ERROR:", signError);
    return { error: "SIGN_ERROR", outletName: outlet.name };
  }

  return { ok: true, outletName: outlet.name, monthName, url: signed.signedUrl };
}

module.exports = { exportInventoryForOutlet };