const { DateTime } = require("luxon");

// ======================
// ITEM NORMALIZER
// ======================
function normalizeItem(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")   // ← replaces dash with space
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
// CURRENCY
// ======================
function formatCurrency(n = 0) {
  return `RM${Number(n)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
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
// MONTH PARSING
// ======================
function parseMonthInput(input) {
  if (!input || input.toLowerCase() === "current") {
    const now = DateTime.now().setZone("Asia/Kuala_Lumpur");
    return {
      start: now.startOf("month").toUTC().toJSDate(),
      end:   now.startOf("month").plus({ months: 1 }).toUTC().toJSDate()
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

  const start = DateTime
    .fromObject({ year, month, day: 1 }, { zone: "Asia/Kuala_Lumpur" })
    .toUTC()
    .toJSDate();

  const end = DateTime
    .fromObject({ year, month, day: 1 }, { zone: "Asia/Kuala_Lumpur" })
    .plus({ months: 1 })
    .toUTC()
    .toJSDate();

  return { start, end };
}

function formatMonthLabel(monthInput, startDate) {
  const d = monthInput && monthInput.toLowerCase() !== "current"
    ? (() => {
        const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
        const [m, y] = monthInput.toLowerCase().split("-");
        return new Date(2000 + parseInt(y), months[m], 1);
      })()
    : new Date(startDate);

  const monthName = d.toLocaleString("en-MY", { month: "long" }); // "May"
  const year      = d.getFullYear();                               // 2026
  const lastDay   = new Date(year, d.getMonth() + 1, 0).getDate(); // 31

  return `${monthName} ${year} (1-${lastDay})`;
}

module.exports = {
  normalizeItem,
  safeQty,
  toProperCase,
  formatCurrency,
  nowMY,
  formatLogDateTime,
  parseMonthInput,
  formatMonthLabel
};