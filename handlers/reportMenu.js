const { withRole } = require("../core/withRole");
const { sendButtons } = require("../services/notification/buttonService");

module.exports = withRole(
  ["manager", "admin"],
  async (ctx) => {

    const { chatId, res } = ctx;

    await sendButtons(
      chatId,
      `📊 REPORT MENU\n\nPilih jenis report:`,
      [
        { id: "SUMMARY",   title: "Summary"   },
        { id: "INVENTORY", title: "Inventory" },
        { id: "FLOW",      title: "Flow"      }
      ]
    );

    return res.end();
  }
);