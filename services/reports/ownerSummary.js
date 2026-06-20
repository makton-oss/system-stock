const { DateTime } = require("luxon");
const { getSummaryReport } = require("./summaryReport");
const { isCurrentMonth } = require("../../utils/helpers");

// ======================
// MODE A: DAY-RANGE (current progress vs same days last month)
// ======================
function getDayRangeWindows() {

  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");
  const dayOfMonth = now.day;

  const currentStart = now.startOf("month");
  const currentEnd   = now.endOf("day");

  const prevMonthStart  = currentStart.minus({ months: 1 });
  const daysInPrevMonth = prevMonthStart.daysInMonth;
  const safeDay         = Math.min(dayOfMonth, daysInPrevMonth);

  const prevStart = prevMonthStart;
  const prevEnd   = prevMonthStart.set({ day: safeDay }).endOf("day");

  return {
    current: {
      start: currentStart.toUTC().toISO(),
      end:   currentEnd.toUTC().toISO()
    },
    previous: {
      start: prevStart.toUTC().toISO(),
      end:   prevEnd.toUTC().toISO()
    },
    label: `${currentStart.toFormat("d")}hb-${currentEnd.toFormat("d")}hb vs bulan lepas ${prevStart.toFormat("d")}hb-${prevEnd.toFormat("d")}hb`
  };
}

// ======================
// MODE B: MONTHLY STRICT — kalau bulan dipilih = bulan semasa, fallback ke day-range
// ======================
function getMonthlyStrictWindows(monthInput) {

  const months = {
    jan: 1, feb: 2,  mar: 3,  apr: 4,
    may: 5, jun: 6,  jul: 7,  aug: 8,
    sep: 9, oct: 10, nov: 11, dec: 12
  };

  const [m, y] = monthInput.toLowerCase().split("-");
  const month  = months[m];
  const year   = 2000 + parseInt(y);

  if (!month || isNaN(year)) return null;

  // ======================
  // BULAN DIPILIH = BULAN SEMASA → guna day-range logic
  // ======================
  if (isCurrentMonth(month, year)) {
    return getDayRangeWindows();
  }

  const currentStart = DateTime.fromObject({ year, month, day: 1 }, { zone: "Asia/Kuala_Lumpur" });
  const currentEnd   = currentStart.plus({ months: 1 }).minus({ milliseconds: 1 });

  const prevStart = currentStart.minus({ months: 1 });
  const prevEnd   = currentStart.minus({ milliseconds: 1 });

  return {
    current: {
      start: currentStart.toUTC().toISO(),
      end:   currentEnd.toUTC().toISO()
    },
    previous: {
      start: prevStart.toUTC().toISO(),
      end:   prevEnd.toUTC().toISO()
    },
    label: `${currentStart.toFormat("LLLL yyyy")} vs ${prevStart.toFormat("LLLL yyyy")}`
  };
}

function pctChange(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

function mergeComparison(currentData, previousData) {

  const prevByName = {};
  previousData.forEach(o => { prevByName[o.outletName] = o; });

  return currentData.map(o => {
    const prev = prevByName[o.outletName] || { stockIn: 0, stockOut: 0, wastage: 0 };

    return {
      ...o,
      prevStockIn:  prev.stockIn,
      prevStockOut: prev.stockOut,
      prevWastage:  prev.wastage,
      inChange:      pctChange(o.stockIn,  prev.stockIn),
      outChange:     pctChange(o.stockOut, prev.stockOut),
      wastageChange: pctChange(o.wastage,  prev.wastage)
    };
  });
}

async function getOwnerReport({ mode, monthInput, outletIds, tenantId }) {

  const windows = mode === "monthly"
    ? getMonthlyStrictWindows(monthInput)
    : getDayRangeWindows();

  if (!windows) return { error: "INVALID_MONTH" };

  const [currentResult, previousResult] = await Promise.all([
    getSummaryReport({ start: windows.current.start,  end: windows.current.end,  outletIds, tenantId }),
    getSummaryReport({ start: windows.previous.start, end: windows.previous.end, outletIds, tenantId })
  ]);

  if (currentResult.error)  return { error: currentResult.error };
  if (previousResult.error) return { error: previousResult.error };

  const sortedCurrent  = [...currentResult].sort((a, b) => a.outletName.localeCompare(b.outletName));
  const sortedPrevious = [...previousResult].sort((a, b) => a.outletName.localeCompare(b.outletName));

  const merged = mergeComparison(sortedCurrent, sortedPrevious);

  return { data: merged, label: windows.label };
}

module.exports = { getOwnerReport };