const { withRole } = require("../core/withRole");
const { sendButtons } = require("../services/notification/buttonService");

function getLast3Months() {

  const months = [];

  const now = new Date();

  // start dari bulan lepas
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

module.exports = withRole(
  ["manager", "admin"],
  async (ctx) => {

    const { chatId, parts, res } = ctx;

    const mode = parts[1]?.toUpperCase();

    if (!mode) {
      return res.end();
    }

    // ======================
    // INVENTORY MODE
    // ======================

    if (mode === "INVENTORY") {

      const now = new Date();

      const lastDayPrevMonth =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          0
        );

      const dd =
        String(
          lastDayPrevMonth.getDate()
        ).padStart(2, "0");

      const mm =
        String(
          lastDayPrevMonth.getMonth() + 1
        ).padStart(2, "0");

      const yy =
        String(
          lastDayPrevMonth.getFullYear()
        ).slice(-2);

      const snapshotDate =
        `${dd}/${mm}/${yy}`;

      const buttons = [
        {
          id: "1",
          title:
            `REPORT INVENTORY ${snapshotDate}`
        }
      ];

      console.log(
        "REPORT BUTTONS:",
        buttons
      );

      await sendButtons(
        chatId,
`📦 INVENTORY SNAPSHOT

Klik butang di bawah untuk dapatkan laporan inventory snapshot bagi bulan lepas, atau
taip tarikh sahaja untuk laporan inventory. Contoh:
30/04/26`,
        buttons
      );

      return res.end();
    }

    // ======================
    // NORMAL REPORT
    // ======================

    const months = getLast3Months();

    const buttons = [
      {
        id: "1",
        title:
          `REPORT ${mode} current`
      },

      ...months.map((m, i) => ({
        id: String(i + 2),
        title:
          `REPORT ${mode} ${m}`
      }))
    ];

    console.log(
      "REPORT BUTTONS:",
      buttons
    );

    await sendButtons(
      chatId,
      `📅 PILIH BULAN\n\n${mode} REPORT`,
      buttons
    );

    return res.end();
  }
);