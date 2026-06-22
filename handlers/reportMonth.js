const { withRole } = require("../core/withRole");
const { sendButtonsRouter } = require("../services/notification/notificationRouter");

// ======================
// CURRENT + LAST 2 MONTHS (3 total, mula dari bulan semasa)
// ======================
function getLast3Months() {

  const months = [];
  const now = new Date();

  for (let i = 0; i <= 2; i++) {

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

module.exports = withRole(
  ["manager", "owner", "admin"],
  async (ctx) => {

    const { chatId, parts, res, channel } = ctx;

    const mode = parts[1]?.toUpperCase();

    if (!mode) return res.end();

    const months = getLast3Months();

    await sendButtonsRouter(
      chatId,
      `📅 PILIH BULAN\n\n${mode} REPORT`,
      months.map(m => ({
        id: `REPORT ${mode} ${m}`,
        title: m
      })),
      channel
    );

    return res.end();
  }
);