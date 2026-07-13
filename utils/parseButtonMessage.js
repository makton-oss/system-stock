const { getOutletByCode } = require("../db/outlets/getOutletByCode");

async function parseButtonMessage({ raw, chatId, body, user, channel = "botcommerce" }) {

  if (!raw.startsWith("#Button Reply#")) {
    return raw;
  }

  const tenantId   = user?.tenant_id || null;
  const clean      = raw.replace("#Button Reply#", "").trim();
  const upperClean = clean.toUpperCase();

  // Telegram inline buttons tak ada reply_message_id — treat semua button press sebagai hasReplyId true
  const hasReplyId = channel === "telegram" ? true : !!body.reply_message_id;

  console.log("BUTTON CLICK:", clean);

  // ======================
  // APPROVE / REJECT
  // ======================
  if (upperClean.startsWith("APPROVE ") || upperClean.startsWith("REJECT ")) {
    const [action, value] = upperClean.split(" ");
    if (/^\d+$/.test(value)) return upperClean;
    const outlet = await getOutletByCode(value, tenantId);
    if (!outlet) return upperClean;
    return `${action}_ALL_${outlet.id}`;
  }

  // ======================
  // DIRECT REPORT COMMAND
  // ======================
  if (upperClean.startsWith("REPORT ")) {
    return clean;
  }

  return upperClean;
}

module.exports = { parseButtonMessage };