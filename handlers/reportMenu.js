const { withRole } = require("../core/withRole");
const { sendButtons } = require("../utils/sendButtons");

module.exports = withRole(
  ["manager", "admin"],
  async (ctx) => {

    const { chatId, res } = ctx;

    await sendButtons(
      chatId,
      `📊 REPORT MENU

Sila pilih jenis report:`,

      [
        {
          id: "REPORT_TYPE SUMMARY",
          title: "Summary"
        },
        {
          id: "REPORT_TYPE INVENTORY",
          title: "Inventory"
        },
        {
          id: "REPORT_TYPE FLOW",
          title: "Flow"
        },
        {
          id: "REPORT_TYPE DETAIL",
          title: "Detail"
        },
        {
          id: "REPORT_TYPE DEAD",
          title: "Dead"
        }
      ]
    );

    return res.end();
  }
);