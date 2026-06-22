const { withRole } = require("../core/withRole");
const { sendButtonsRouter } = require("../services/notification/notificationRouter");

module.exports = withRole(["manager", "owner", "admin"], async (ctx) => {

  const { chatId, user, res, channel } = ctx;
  const isOwner = user.role === "owner" || user.role === "superadmin";

  // ======================
  // ROW 1
  // ======================
  await sendButtonsRouter(
    chatId,
    `📊 REPORT MENU\n\n1. Monthly Overview — ringkasan nilai stok\n2. Stock Value — nilai stok pada tarikh\n3. In/Out Flow — aliran nilai masuk keluar`,
    [
      { id: "SUMMARY",   title: "SUMMARY"   },
      { id: "INVENTORY", title: "INVENTORY" },
      { id: "FLOW",      title: "FLOW"      }
    ],
    channel
  );

  // ======================
  // ROW 2
  // ======================
  const row2Buttons = [
    { id: "DEAD",   title: "DEAD"   }
  ];

  if (isOwner) {
    row2Buttons.push(
      { id: "COMPARE", title: "COMPARE" }
    );
  }

  await sendButtonsRouter(
    chatId,
    `4. Dead Stock — item tiada movement\n6. Outlet Compare — banding bulan & outlet`,
    row2Buttons,
    channel
  );

  return res.end();
});