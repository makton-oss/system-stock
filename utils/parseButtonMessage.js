function parseButtonMessage({
  raw,
  chatId,
  body
}) {

  if (!raw.startsWith("#Button Reply#")) {
    return raw;
  }

  const clean =
    raw.replace("#Button Reply#", "").trim();

  const upperClean =
    clean.toUpperCase();

  console.log(
    "BUTTON CLICK:",
    clean
  );

  global.buttonMap =
    global.buttonMap || {};

  const mapped =
    global.buttonMap?.[chatId]?.[upperClean];

  if (mapped) {

    console.log(
      "BUTTON MAPPED:",
      mapped
    );

    return mapped;
  }

  // ======================
  // REPORT FLOW
  // ======================

  if (
    upperClean.startsWith("REPORT_TYPE")
  ) {
    return upperClean;
  }

  if (
    ["SUMMARY", "INVENTORY", "FLOW"]
    .includes(upperClean)
  ) {
    return `REPORT_MONTH ${upperClean}`;
  }

  if (
    upperClean === "CURRENT" ||
    /^[A-Z]{3}-\d{2}$/i.test(clean)
  ) {

    if (
      body.reply_message_id &&
      global.reportModeMap?.[chatId]
    ) {

      const mode =
        global.reportModeMap[chatId];

      return `REPORT ${mode} ${clean.toLowerCase()}`;
    }
  }

  return upperClean;
}

module.exports = {
  parseButtonMessage
};