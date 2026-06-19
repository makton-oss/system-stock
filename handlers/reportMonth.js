const { withRole } = require("../core/withRole");
const { sendButtonsRouter } = require("../notification/notificationRouter");

// ======================
// LAST 3 MONTHS
// ======================
function getLast3Months() {

  const months = [];
  const now = new Date();

  for (let i = 1; i <= 3; i++) {

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
    // OTHER REPORTS
    // ======================
    const months = getLast3Months();

    await sendButtonsRouter(
      chatId,
      `📅 PILIH BULAN\n\n${mode} REPORT`, 
      months.map(m => ({
        id: `REPORT ${mode} ${m}`,
        title: m
      }))
    );

    return res.end();
  }
);