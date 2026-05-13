// ======================
// RESPONSE
// ======================

function ok(res) {
  return res.status(200).end();
}

// ======================
// DB ERROR
// ======================

async function handleDbError(error, chatId, reply) {

  if (!error) return false;

  console.log("DB ERROR:", error);

  await reply(chatId, "❌ DATABASE ERROR");

  return true;
}

// ======================
// ACCESS DENY
// ======================

async function deny(chatId, reply, text = "❌ NO ACCESS") {
  await reply(chatId, text);
  return true;
}

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

  if (isNaN(qty) || qty <= 0) {
    return null;
  }

  return qty;
}

// ======================
// LOW STOCK CHECKER
// ======================
function isLowStock(qty, minQty) {
  return qty <= minQty;
}

module.exports = {
  ok,
  handleDbError,
  deny,
  normalizeItem,
  safeQty,
  isLowStock
};