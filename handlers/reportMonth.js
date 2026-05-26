const { withRole } = require("../core/withRole");
const { sendButtons } = require("../services/notification/buttonService");

// ======================
// LAST 2 MONTHS
// ======================
function getLast2Months() {

  const months = [];
  const now = new Date();

  for (let i = 1; i <= 2; i++) {

    const d = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    const month = d
      .toLocaleString("en-MY", { month: "short" })
      .toLowerCase();

    const year = d
      .getFullYear()
      .toString()
      .slice(-2);

    months.push(`${month}-${year}`);
  }

  return months;
}

// ======================
// LAST MONTH dd/mm/yy
// ======================
function getLastMonthDate() {

  const now = new Date();

  const lastDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    0
  );

  const dd = String(lastDay.getDate()).padStart(2, "0");
  const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
  const yy = String(lastDay.getFullYear()).slice(-2);

  return `${dd}/${mm}/${yy}`;
}

module.exports = withRole(
  ["manager", "admin"],
  async (ctx) => {

    const { chatId, parts, res } = ctx;

    const mode = parts[1]?.toUpperCase();

    if (!mode) return res.end();

    // ======================
    // INVENTORY
    // ======================
    if (mode === "INVENTORY") {

      const lastMonthDate = getLastMonthDate();

      await sendButtons(
        chatId,
        `📦 INVENTORY REPORT\n\nKlik butang atau taip tarikh:\nContoh: REPORT INVENTORY 30/04/26`,
        [
          {
            id: `REPORT INVENTORY ${lastMonthDate}`,
            title: lastMonthDate  // "30/04/26" ← dynamic, boleh parse
          }
        ]
      );

      return res.end();
    }

    // ======================
    // OTHER REPORTS
    // ======================
    const months = getLast2Months();

    await sendButtons(
      chatId,
      `📅 PILIH BULAN\n\n${mode} REPORT`,
      [
        {
          id: `REPORT ${mode} current`,
          title: "current"
        },
        ...months.map(m => ({
          id: `REPORT ${mode} ${m}`,
          title: m
        }))
      ]
    );

    return res.end();
  }
);