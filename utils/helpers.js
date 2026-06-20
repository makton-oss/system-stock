const { DateTime } = require("luxon");

// ======================
// ITEM NORMALIZER
// ======================
function normalizeItem(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

// ======================
// SAFE INTEGER
// ======================
function safeQty(value) {
  const qty = parseInt(value);
  if (isNaN(qty) || qty <= 0) return null;
  return qty;
}

// ======================
// PROPER CASE
// ======================
function toProperCase(str = "") {
  return str
    .toString()
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ======================
// CURRENCY (legacy)
// ======================
function formatCurrency(n = 0) {
  return `RM${Number(n)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

// ======================
// AMOUNT (2 decimal + comma separator)
// ======================
function formatAmount(n = 0) {
  return Number(n)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ======================
// DATE & TIME
// ======================
function nowMY() {
  return DateTime.now().setZone("Asia/Kuala_Lumpur");
}

function formatLogDateTime(date = null) {
  const d = date
    ? DateTime.fromJSDate(new Date(date)).setZone("Asia/Kuala_Lumpur")
    : nowMY();
  return d.toFormat("d/M HH:mm");
}

// ======================
// CHECK: IS THIS MONTH THE CURRENT MONTH?
// ======================
function isCurrentMonth(month, year) {
  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");
  return now.month === month && now.year === year;
}

// ======================
// MONTH PARSING
// "current" ATAU bulan semasa (e.g. jun-26 bila hari ni Jun) → day-range
// bulan lepas/lain → whole month
// ======================
function parseMonthInput(input) {

  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");

  // ======================
  // KEYWORD "current"
  // ======================
  if (!input || input.toLowerCase() === "current") {
    return {
      start: now.startOf("month").toUTC().toJSDate(),
      end:   now.endOf("day").toUTC().toJSDate(),
      isDayRange: true
    };
  }

  const months = {
    jan: 1, feb: 2,  mar: 3,  apr: 4,
    may: 5, jun: 6,  jul: 7,  aug: 8,
    sep: 9, oct: 10, nov: 11, dec: 12
  };

  const [m, y] = input.toLowerCase().split("-");
  const month  = months[m];
  const year   = 2000 + parseInt(y);

  if (!month || isNaN(year)) return null;

  // ======================
  // BULAN YANG DIPILIH = BULAN SEMASA → day-range juga
  // ======================
  if (isCurrentMonth(month, year)) {
    return {
      start: now.startOf("month").toUTC().toJSDate(),
      end:   now.endOf("day").toUTC().toJSDate(),
      isDayRange: true
    };
  }

  // ======================
  // BULAN LAIN → whole month
  // ======================
  const start = DateTime
    .fromObject({ year, month, day: 1 }, { zone: "Asia/Kuala_Lumpur" })
    .toUTC()
    .toJSDate();

  const end = DateTime
    .fromObject({ year, month, day: 1 }, { zone: "Asia/Kuala_Lumpur" })
    .plus({ months: 1 })
    .toUTC()
    .toJSDate();

  return { start, end, isDayRange: false };
}

// ======================
// MONTH LABEL
// ======================
function formatMonthLabel(monthInput, startDate) {

  const now = DateTime.now().setZone("Asia/Kuala_Lumpur");
  let d, isDayRange, dayOfMonth;

  if (!monthInput || monthInput.toLowerCase() === "current") {
    d = now.toJSDate();
    isDayRange = true;
    dayOfMonth = now.day;
  } else {
    const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    const [m, y] = monthInput.toLowerCase().split("-");
    const month  = months[m];
    const year   = 2000 + parseInt(y);

    d = new Date(year, month - 1, 1);
    isDayRange = isCurrentMonth(month, year);
    dayOfMonth = isDayRange ? now.day : null;
  }

  const monthName = d.toLocaleString("en-MY", { month: "long" });
  const year      = d.getFullYear();
  const lastDay   = new Date(year, d.getMonth() + 1, 0).getDate();

  if (isDayRange) {
    return `${monthName} ${year} (1hb-${dayOfMonth}hb)`;
  }

  return `${monthName} ${year} (1hb-${lastDay}hb)`;
}

module.exports = {
  normalizeItem,
  safeQty,
  toProperCase,
  formatCurrency,
  formatAmount,
  nowMY,
  formatLogDateTime,
  parseMonthInput,
  formatMonthLabel,
  isCurrentMonth
};