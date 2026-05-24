const supabase = require("../services/db");
const { getOutletIdByCode } = require("./getOutletByCode");

async function parseButtonMessage({
  raw,
  chatId,
  body
}) {

  if (!raw.startsWith("#Button Reply#")) {
    return raw;
  }

  const clean =
    raw.replace(
      "#Button Reply#",
      ""
    ).trim();

  const upperClean =
    clean.toUpperCase();

  console.log(
    "BUTTON CLICK:",
    clean
  );

  // ======================
  // APPROVE / REJECT ALL
  // ======================

  if (
    upperClean.startsWith("APPROVE ") ||
    upperClean.startsWith("REJECT ")
  ) {

    const [action, value] =
      upperClean.split(" ");

    // SINGLE REQUEST
    if (/^\d+$/.test(value)) {
      return upperClean;
    }

    // OUTLET CODE
    const outletId =
      await getOutletIdByCode(
        value
      );

    console.log(
      "OUTLET LOOKUP:",
      value,
      outletId
    );

    if (!outletId) {
      return upperClean;
    }

    console.log(
      "CONVERT:",
      upperClean,
      "->",
      `${action}_ALL_${outletId}`
    );

    return `${action}_ALL_${outletId}`;
  }

  // ======================
  // DIRECT REPORT BUTTON
  // ======================

  if (
    upperClean.startsWith("REPORT ")
  ) {

    return clean;
  }

  // ======================
  // REPORT FLOW
  // ======================

  if (
    upperClean.startsWith(
      "REPORT_TYPE"
    )
  ) {
    return upperClean;
  }

  // ======================
  // REPORT MODE
  // ======================

  if (
    [
      "SUMMARY",
      "INVENTORY",
      "FLOW",
      "DEAD",
      "DETAIL"
    ].includes(upperClean)
  ) {

    return `REPORT_MONTH ${upperClean}`;
  }

  return upperClean;
}

module.exports = {
  parseButtonMessage
};