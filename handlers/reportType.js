const { withRole } = require("../core/withRole");
const { sendButtons } = require("../utils/sendButtons");

function getLast6Months() {

  const months = [];

  const now = new Date();

  for (let i = 0; i < 6; i++) {

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
  ["manager", "admin", "supervisor"],
  async (ctx) => {

    const { chatId, parts, res } = ctx;

    const mode = parts[1]?.toUpperCase();

    if (!mode) {
      return res.end();
    }

    const months = getLast6Months();

    const buttons = [
      {
        id: `REPORT ${mode} current`,
        title: "Current"
      },

      ...months.map(m => ({
        id: `REPORT ${mode} ${m}`,
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