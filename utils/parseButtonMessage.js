const supabase = require("../services/db");
const { getOutletIdByCode } = require("./getOutletByCode");

async function parseButtonMessage({ raw, chatId, body }) {

  if (!raw.startsWith("#Button Reply#")) {
    return raw;
  }

  const clean = raw.replace("#Button Reply#", "").trim();
  const upperClean = clean.toUpperCase();
  const hasReplyId = !!body.reply_message_id;

  console.log("BUTTON CLICK:", clean);

  // ======================
  // APPROVE / REJECT
  // ======================
  if (
    upperClean.startsWith("APPROVE ") ||
    upperClean.startsWith("REJECT ")
  ) {
    const [action, value] = upperClean.split(" ");

    if (/^\d+$/.test(value)) return upperClean;

    const outletId = await getOutletIdByCode(value);
    if (!outletId) return upperClean;

    return `${action}_ALL_${outletId}`;
  }

  // ======================
  // REPORT TYPE SELECTION
  // click dari reportMenu
  // ======================
  const REPORT_MODES = ["SUMMARY", "INVENTORY", "FLOW", "DEAD", "DETAIL"];

  if (REPORT_MODES.includes(upperClean) && hasReplyId) {

    global.reportModeMap = global.reportModeMap || {};
    global.reportModeMap[chatId] = upperClean;

    console.log("SET REPORT MODE:", chatId, upperClean);

    return `REPORT_MONTH ${upperClean}`;
  }

  // ======================
  // MONTH SELECTION
  // click dari reportMonth (non-inventory)
  // "current" atau "may-26"
  // ======================
  if (hasReplyId) {

    const mode = global.reportModeMap?.[chatId];

    if (
      upperClean === "CURRENT" ||
      /^[A-Z]{3}-\d{2}$/i.test(clean)
    ) {
      if (mode && mode !== "INVENTORY") {
        delete global.reportModeMap[chatId];
        return `REPORT ${mode} ${clean.toLowerCase()}`;
      }
    }

    // ======================
    // INVENTORY DATE BUTTON
    // click "30/04/26" button
    // ======================
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(clean)) {
      if (mode === "INVENTORY") {
        delete global.reportModeMap[chatId];
        return `REPORT INVENTORY ${clean}`;
      }
    }
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