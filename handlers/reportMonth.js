const { withRole } = require("../core/withRole");
const { sendButtons } = require("../services/notification/buttonService");

function getLast3Months() {

  const months = [];

  const now = new Date();

  // current + 2 previous
  for (let i = 0; i <= 2; i++) {

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

module.exports = withRole(
  ["manager", "admin"],
  async (ctx) => {

    const { chatId, parts, res } = ctx;

    const mode = parts[1]?.toUpperCase();

    if (!mode) {
      return res.end();
    }

    const months =
      getLast3Months();

    const currentMonth =
      months[0];

    const previousMonths =
      months.slice(1);

    const buttons = [

      {
        id:
          `REPORT ${mode} current`,

        title:
          `CURRENT (${currentMonth.toUpperCase()})`
      },

      ...previousMonths.map(m => ({

        id:
          `REPORT ${mode} ${m}`,

        title:
          m.toUpperCase()
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