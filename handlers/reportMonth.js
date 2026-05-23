const { withRole } = require("../core/withRole");
const { sendButtons } = require("../services/notification/buttonService");

function getLast3Months() {

  const months = [];

  const now = new Date();

  for (let i = 1; i <= 2; i++) {

    const d = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    const month = d
      .toLocaleString("en-MY", {
        month: "short"
      })
      .toLowerCase();

    const year = d
      .getFullYear()
      .toString()
      .slice(-2);

    months.push(`${month}-${year}`);
  }

  return months;
}

function getCurrentMonthLabel() {

  const now = new Date();

  const month = now
    .toLocaleString("en-MY", {
      month: "short"
    })
    .toUpperCase();

  const year = now
    .getFullYear()
    .toString()
    .slice(-2);

  return `${month}-${year}`;
}

module.exports = withRole(
  ["manager", "admin"],
  async (ctx) => {

    const { chatId, parts, res } = ctx;

    const mode = parts[1]?.toUpperCase();

    if (!mode) {
      return res.end();
    }

    global.reportModeMap =
      global.reportModeMap || {};

    global.reportModeMap[chatId] =
      mode;

    const months =
      getLast3Months();

    const currentLabel =
      getCurrentMonthLabel();

    const buttons = [

      {
        id: "CURRENT",
        title: `CURRENT (${currentLabel})`
      },

      ...months.map(m => ({

        id: m.toUpperCase(),
        title: m.toUpperCase()

      }))
    ];

    await sendButtons(
      chatId,
      `📅 PILIH BULAN\n\n${mode} REPORT`,
      buttons
    );

    return res.end();
  }
);