const supabase = require("../services/db");
const { getOutletByCode } = require("./getOutletByCode");
const reportModeStore = require("./reportModeStore");

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

    const outlet = await getOutletByCode(value);
    if (!outlet) return upperClean;

    return `${action}_ALL_${outlet.id}`;
  }

  // ======================
  // REPORT TYPE SELECTION
  // click dari reportMenu
  // ======================
  const REPORT_MODES = ["SUMMARY", "INVENTORY", "FLOW", "DEAD", "DETAIL"];

  if (REPORT_MODES.includes(upperClean) && hasReplyId) {

    reportModeStore.set(chatId, upperClean);

    console.log("SET REPORT MODE:", chatId, upperClean);

    return `REPORT_MONTH ${upperClean}`;
  }

  // ======================
  // MONTH SELECTION
  // click dari reportMonth (non-inventory)
  // ======================
  if (hasReplyId) {

    const mode = reportModeStore.get(chatId);

    if (
      upperClean === "CURRENT" ||
      /^[A-Z]{3}-\d{2}$/i.test(clean)
    ) {
      if (mode && mode !== "INVENTORY") {
        reportModeStore.del(chatId);
        return `REPORT ${mode} ${clean.toLowerCase()}`;
      }
    }

    // ======================
    // INVENTORY DATE BUTTON
    // ======================
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(clean)) {
      if (mode === "INVENTORY") {
        reportModeStore.del(chatId);
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