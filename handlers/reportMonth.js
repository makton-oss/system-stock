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

      await sendButtons(
        chatId,
`📦 INVENTORY SNAPSHOT

Klik butang di bawah untuk dapatkan laporan inventory snapshot bagi bulan lepas, atau
taip tarikh sahaja untuk laporan inventory. Contoh:
30/04/26`,
        [
          {
            id: `REPORT INVENTORY ${snapshotDate}`,
            title: "LAST MONTH"
          }
        ]
      );

      return res.end();
    }

    // ======================
    // NORMAL REPORT
    // ======================

    const months = getLast3Months();

    let buttons;

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

      buttons = [
        {
          id: `REPORT INVENTORY ${snapshotDate}`,
          title: "LAST MONTH"
        }
      ];

    } else {

      buttons = [
        {
          id: `REPORT ${mode} current`,
          title: "Current"
        },

        ...months.map(m => ({
          id: `REPORT ${mode} ${m}`,
          title: m.toUpperCase()
        }))
      ];
    };

    await sendButtons(
      chatId,
      `📅 PILIH BULAN\n\n${mode} REPORT`,
      buttons
    );

    return res.end();
  }
);