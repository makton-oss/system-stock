const ExcelJS = require("exceljs");
const { getMonthlyOwnerReport } = require("../reports/monthlyOwnerReport");
const { getDetailReport } = require("../reportService");
const { toProperCase, formatAmount } = require("../../utils/helpers");
const { ensureExportsBucket, uploadAndSign, sanitizeSheetName } = require("./storage");
const { DateTime } = require("luxon");

// ======================
// HELPERS
// ======================
function styleHeader(cell, bold = true) {
  cell.font = { bold };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE1F5EE" } };
}

function currency(val) {
  return Number(val || 0);
}

// ======================
// SHEET 1 — EXECUTIVE SUMMARY
// ======================
function addSummarySheet(workbook, data, label, snapshotDate) {
  const sheet = workbook.addWorksheet("Summary");
  const B = 2;

  sheet.getCell(2, B).value = "MONTHLY REPORT — EXECUTIVE SUMMARY";
  sheet.getCell(2, B).font = { bold: true, size: 13 };
  sheet.getCell(3, B).value = label;
  sheet.getCell(4, B).value = `Snapshot: ${snapshotDate || "-"}`;
  sheet.getCell(4, B).font = { italic: true, color: { argb: "FF6B7280" } };

  const totalClosing  = data.reduce((a, o) => a + currency(o.closingValue), 0);
  const totalOpening  = data.reduce((a, o) => a + currency(o.openingValue), 0);
  const totalStockIn  = data.reduce((a, o) => a + currency(o.stockIn), 0);
  const totalStockOut = data.reduce((a, o) => a + currency(o.stockOut), 0);
  const totalWastage  = data.reduce((a, o) => a + currency(o.wastage), 0);
  const netChange     = totalClosing - totalOpening;

  let row = 6;
  const summaryRows = [
    ["Inventory Value (Closing)", totalClosing],
    ["Opening Inventory",         totalOpening],
    ["Net Change",                netChange],
    ["Stock In",                  totalStockIn],
    ["Stock Out",                 totalStockOut],
    ["Wastage",                   totalWastage],
  ];

  summaryRows.forEach(([label, val]) => {
    sheet.getCell(row, B).value     = label;
    sheet.getCell(row, B + 1).value = val;
    sheet.getCell(row, B + 1).numFmt = `"RM "#,##0.00`;
    if (label === "Net Change") {
      sheet.getCell(row, B + 1).font = { color: { argb: netChange >= 0 ? "FF16A34A" : "FFDC2626" } };
    }
    row++;
  });

  // Comparison section
  const hasComparison = data.some(o => o.prevStockIn !== undefined);
  if (hasComparison) {
    row++;
    sheet.getCell(row, B).value = "VS BULAN LEPAS";
    sheet.getCell(row, B).font = { bold: true };
    row++;

    const headers = ["KPI", "Semasa (RM)", "Lepas (RM)", "Perubahan %"];
    headers.forEach((h, i) => {
      const c = sheet.getCell(row, B + i);
      c.value = h;
      styleHeader(c);
    });
    row++;

    const kpis = [
      ["Stock In",  data.reduce((a, o) => a + currency(o.stockIn), 0),  data.reduce((a, o) => a + currency(o.prevStockIn), 0)],
      ["Stock Out", data.reduce((a, o) => a + currency(o.stockOut), 0), data.reduce((a, o) => a + currency(o.prevStockOut), 0)],
      ["Wastage",   data.reduce((a, o) => a + currency(o.wastage), 0),  data.reduce((a, o) => a + currency(o.prevWastage), 0)],
    ];

    kpis.forEach(([name, curr, prev]) => {
      const pct = prev > 0 ? ((curr - prev) / prev * 100) : 0;
      sheet.getCell(row, B).value         = name;
      sheet.getCell(row, B + 1).value     = curr;
      sheet.getCell(row, B + 1).numFmt    = `"RM "#,##0.00`;
      sheet.getCell(row, B + 2).value     = prev;
      sheet.getCell(row, B + 2).numFmt    = `"RM "#,##0.00`;
      sheet.getCell(row, B + 3).value     = pct / 100;
      sheet.getCell(row, B + 3).numFmt    = "0.0%";
      sheet.getCell(row, B + 3).font      = { color: { argb: pct > 0 ? "FFDC2626" : "FF16A34A" } };
      row++;
    });
  }

  // Outlet breakdown (if >1)
  if (data.length > 1) {
    row++;
    sheet.getCell(row, B).value = "OUTLET BREAKDOWN";
    sheet.getCell(row, B).font = { bold: true };
    row++;

    const outletHeaders = ["Outlet", "Inventory (RM)", "Usage (RM)", "Wastage (RM)", "Wastage %"];
    outletHeaders.forEach((h, i) => {
      const c = sheet.getCell(row, B + i);
      c.value = h;
      styleHeader(c);
    });
    row++;

    const sorted = [...data].sort((a, b) => currency(b.stockOut) - currency(a.stockOut));
    sorted.forEach(o => {
      sheet.getCell(row, B).value         = toProperCase(o.outletName);
      sheet.getCell(row, B + 1).value     = currency(o.closingValue);
      sheet.getCell(row, B + 1).numFmt    = `"RM "#,##0.00`;
      sheet.getCell(row, B + 2).value     = currency(o.stockOut);
      sheet.getCell(row, B + 2).numFmt    = `"RM "#,##0.00`;
      sheet.getCell(row, B + 3).value     = currency(o.wastage);
      sheet.getCell(row, B + 3).numFmt    = `"RM "#,##0.00`;
      sheet.getCell(row, B + 4).value     = (o.wastagePercent || 0) / 100;
      sheet.getCell(row, B + 4).numFmt    = "0.0%";
      row++;
    });
  }

  sheet.columns = [
    { width: 4 },
    { width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }
  ];
}

// ======================
// SHEET 2 — LOW STOCK
// ======================
function addLowStockSheet(workbook, lowStock, snapshotDate) {
  const sheet = workbook.addWorksheet("Low Stock");
  const B = 2;

  sheet.getCell(2, B).value = "LOW STOCK REPORT";
  sheet.getCell(2, B).font = { bold: true, size: 13 };
  sheet.getCell(3, B).value = `As of: ${snapshotDate || "-"}`;
  sheet.getCell(3, B).font = { italic: true, color: { argb: "FF6B7280" } };

  if (!lowStock?.length) {
    sheet.getCell(5, B).value = "✅ Tiada low stock item";
    return;
  }

  let row = 5;
  const headers = ["Outlet", "Item", "Qty Semasa", "Min Qty", "Kurang"];
  headers.forEach((h, i) => {
    const c = sheet.getCell(row, B + i);
    c.value = h;
    styleHeader(c);
  });
  row++;

  // Group by outlet
  const byOutlet = {};
  lowStock.forEach(s => {
    const name = s.outlets?.name || "Outlet";
    if (!byOutlet[name]) byOutlet[name] = [];
    byOutlet[name].push(s);
  });

  Object.entries(byOutlet).forEach(([outlet, items]) => {
    items.forEach(s => {
      const diff = Number(s.min_qty) - Number(s.qty);
      sheet.getCell(row, B).value     = toProperCase(outlet);
      sheet.getCell(row, B + 1).value = toProperCase(s.item_name);
      sheet.getCell(row, B + 2).value = Number(s.qty);
      sheet.getCell(row, B + 3).value = Number(s.min_qty);
      sheet.getCell(row, B + 4).value = diff;
      sheet.getCell(row, B + 4).font  = { color: { argb: "FFDC2626" } };
      row++;
    });
  });

  sheet.getCell(row + 1, B).value = `Total: ${lowStock.length} item`;
  sheet.getCell(row + 1, B).font = { bold: true };

  sheet.columns = [
    { width: 4 },
    { width: 20 }, { width: 24 }, { width: 12 }, { width: 12 }, { width: 10 }
  ];
}

// ======================
// SHEET 3 — DEAD STOCK
// ======================
function addDeadStockSheet(workbook, deadResult, snapshotDate) {
  const sheet = workbook.addWorksheet("Dead Stock");
  const B = 2;

  sheet.getCell(2, B).value = "DEAD STOCK REPORT";
  sheet.getCell(2, B).font = { bold: true, size: 13 };
  sheet.getCell(3, B).value = `As of: ${snapshotDate || "-"}`;
  sheet.getCell(3, B).font = { italic: true, color: { argb: "FF6B7280" } };

  if (!deadResult || deadResult.error) {
    sheet.getCell(5, B).value = "Tiada data dead stock";
    return;
  }

  let row = 5;
  let hasAny = false;

  Object.entries(deadResult).forEach(([outletName, rows]) => {
    const dead = rows.filter(r => r.neverMoved || r.daysSince >= 30);
    if (!dead.length) return;

    hasAny = true;

    sheet.getCell(row, B).value = toProperCase(outletName);
    sheet.getCell(row, B).font = { bold: true };
    row++;

    const headers = ["Item", "Hari Tak Bergerak"];
    headers.forEach((h, i) => {
      const c = sheet.getCell(row, B + i);
      c.value = h;
      styleHeader(c);
    });
    row++;

    dead.forEach(r => {
      sheet.getCell(row, B).value     = toProperCase(r.name);
      sheet.getCell(row, B + 1).value = r.neverMoved ? "Tidak pernah direkod" : `${r.daysSince} hari`;
      if (!r.neverMoved && r.daysSince >= 90) {
        sheet.getCell(row, B + 1).font = { color: { argb: "FFDC2626" } };
      }
      row++;
    });

    row++;
  });

  if (!hasAny) {
    sheet.getCell(5, B).value = "✅ Tiada dead stock item (30+ hari)";
  }

  sheet.columns = [
    { width: 4 },
    { width: 28 }, { width: 22 }
  ];
}

// ======================
// SHEET 4 — DETAIL (per outlet per item)
// ======================
function addDetailSheet(workbook, detailResult, label) {
  const sheet = workbook.addWorksheet("Detail");
  const B = 2;

  sheet.getCell(2, B).value = "DETAIL MOVEMENT REPORT";
  sheet.getCell(2, B).font = { bold: true, size: 13 };
  sheet.getCell(3, B).value = label;

  if (!detailResult || detailResult.error || !Object.keys(detailResult).length) {
    sheet.getCell(5, B).value = "Tiada data movement";
    return;
  }

  let row = 5;

  Object.entries(detailResult).forEach(([outletName, rows]) => {
    if (!rows?.length) return;

    sheet.getCell(row, B).value = toProperCase(outletName);
    sheet.getCell(row, B).font = { bold: true };
    row++;

    const headers = ["Item", "IN", "OUT", "Wastage", "Baki"];
    headers.forEach((h, i) => {
      const c = sheet.getCell(row, B + i);
      c.value = h;
      styleHeader(c);
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

    // Totals row
    ["TOTAL", totals.in, totals.out, totals.wastage, totals.bal].forEach((val, i) => {
      const c = sheet.getCell(row, B + i);
      c.value = val;
      c.font = { bold: true };
    });

    row += 2;
  });

  sheet.columns = [
    { width: 4 },
    { width: 26 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 10 }
  ];
}

// ======================
// MAIN EXPORT FUNCTION
// ======================
async function exportMonthlyFull({ outletIds, tenantId, chatId, monthInput, mode }) {

  const bucketReady = await ensureExportsBucket();
  if (!bucketReady) return { error: "BUCKET_ERROR" };

  // Derive date range label + start/end for detail query
  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");
  let start, end, monthSlug, monthLabel;

  if (mode === "monthly" && monthInput) {
    const months = {
      jan: 1, feb: 2, mar: 3, apr: 4,
      may: 5, jun: 6, jul: 7, aug: 8,
      sep: 9, oct: 10, nov: 11, dec: 12
    };
    const [m, y] = monthInput.toLowerCase().split("-");
    const month  = months[m];
    const year   = 2000 + parseInt(y);

    if (!month || isNaN(year)) return { error: "INVALID_MONTH" };

    const startDT = DateTime.fromObject({ year, month, day: 1 }, { zone: "Asia/Kuala_Lumpur" });
    const endDT   = startDT.endOf("month");

    start      = startDT.toUTC().toISO();
    end        = endDT.toUTC().toISO();
    monthSlug  = startDT.toFormat("yyyy-MM");
    monthLabel = startDT.toFormat("LLLL yyyy").toUpperCase();
  } else {
    // Current month day-range
    const startDT = now.startOf("month");
    const endDT   = now.endOf("day");

    start      = startDT.toUTC().toISO();
    end        = endDT.toUTC().toISO();
    monthSlug  = now.toFormat("yyyy-MM");
    monthLabel = `${now.toFormat("LLLL yyyy").toUpperCase()} (1-${now.day})`;
  }

  // Fetch all data in parallel
  const [monthlyResult, detailResult] = await Promise.all([
    getMonthlyOwnerReport({ mode, monthInput, outletIds, tenantId }),
    getDetailReport({ start, end, outletIds, tenantId })
  ]);

  if (monthlyResult.error) return { error: monthlyResult.error };

  // Build workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator  = "StokBot";
  workbook.created  = new Date();

  addSummarySheet(workbook, monthlyResult.data, monthLabel, monthlyResult.snapshotDate);
  addLowStockSheet(workbook, monthlyResult.lowStock, monthlyResult.snapshotDate);
  addDeadStockSheet(workbook, monthlyResult.deadStockCount > 0 ? await getDeadResultForExport({ outletIds, tenantId, monthlyResult }) : null, monthlyResult.snapshotDate);
  addDetailSheet(workbook, detailResult, monthLabel);

  // Upload
  const result = await uploadAndSign(workbook, {
    tenantId,
    chatId,
    reportType: "FULL",
    monthSlug
  });

  if (result.error) return result;

  return {
    ok:         true,
    url:        result.url,
    monthLabel,
    fileName:   result.fileName,
    sheetCount: workbook.worksheets.length
  };
}

// Dead stock query for Excel (need full data, not just count)
async function getDeadResultForExport({ outletIds, tenantId, monthlyResult }) {
  const { getDeadReport } = require("../reportService");
  const asOfDate = DateTime
    .fromFormat(monthlyResult.snapshotDate, "yyyy-MM-dd", { zone: "Asia/Kuala_Lumpur" })
    .endOf("day")
    .toUTC()
    .toISO();

  const result = await getDeadReport({ outletIds, tenantId, asOfDate });
  return result.error ? null : result;
}

module.exports = { exportMonthlyFull };