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
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end:   new Date(now.getFullYear(), now.getMonth() + 1, 1)
    };
  }

  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3,
    may: 4, jun: 5, jul: 6, aug: 7,
    sep: 8, oct: 9, nov: 10, dec: 11
  };

  const [m, y] = input.toLowerCase().split("-");
  const month  = months[m];
  const year   = 2000 + parseInt(y);

  if (month === undefined || isNaN(year)) return null;

  return {
    start: new Date(year, month, 1),
    end:   new Date(year, month + 1, 1)
  };
}

function formatMonthLabel(monthInput, startDate) {
  if (!monthInput || monthInput.toLowerCase() === "current") {
    const d     = new Date(startDate);
    const month = toProperCase(d.toLocaleString("en-MY", { month: "long" }));
    return `${month} ${d.getFullYear()}`;
  }
  return monthInput.toUpperCase();
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