const { withRole } = require("../core/withRole");
const { sendButtonsRouter } = require("../notification/notificationRouter");

module.exports = withRole(["manager", "owner", "admin"], async (ctx) => {

  const { chatId, user, res } = ctx;
  const isAdmin = ["admin", "owner"].includes(user.role);

  // ======================
  // ROW 1
  // ======================
  await sendButtonsRouter(
    chatId,
    `📊 REPORT MENU\n\n1. Monthly Overview — ringkasan nilai stok\n2. Stock Value — nilai stok pada tarikh\n3. In/Out Flow — aliran nilai masuk keluar`,
    [
      { id: " SUMMARY",   title: "SUMMARY"   },
      { id: " INVENTORY", title: "INVENTORY" },
      { id: " FLOW",      title: "FLOW"      }
    ]
  );

  // ======================
  // ROW 2
  // ======================
  const row2Buttons = [
    { id: " DETAIL",  title: "DETAIL"  },
    { id: " DEAD",    title: "DEAD"    }
  ];

  if (isAdmin) {
    row2Buttons.push(
      { id: " COMPARE", title: "COMPARE" }
    );
  }

  await sendButtonsRouter(
    chatId,
    `4. Item Movement — kuantiti per item\n5. Dead Stock — item tiada movement\n6. Outlet Compare — banding semua outlet (admin)`,
    row2Buttons
  );

  return res.end();
});