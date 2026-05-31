const { withRole } = require("../core/withRole");
const { parseUpItem } = require("../utils/parseUpdateItems");
const { updateStockItem } = require("../services/stock/updateItem");

const FORMAT_MSG =
`❌ FORMAT:
UPITEM ayam rempah cost 3.5 muiz
UPITEM ayam rempah min 5 muiz
UPITEM ayam rempah cost 3.5 min 5 muiz`;

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, reply, res } = ctx;

  // ======================
  // PARSE
  // ======================
  const parsed = parseUpItem(parts);

  if (parsed.error) {

    const msgs = {
      NO_UPDATES  : FORMAT_MSG,
      NO_ITEM     : "❌ Nama item tak jumpa",
      NO_OUTLET   : "❌ Nama outlet tak jumpa (letak last sekali)",
      INVALID_COST: "❌ Cost tak valid",
      INVALID_MIN : "❌ Min qty tak valid"
    };

    await reply(
      chatId,
      msgs[parsed.error] || FORMAT_MSG
    );

    return res.end();
  }

  // ======================
  // SERVICE
  // ======================
  const result =
    await updateStockItem(parsed);

  if (result.error) {

    const msgs = {
      OUTLET_NOT_FOUND: `❌ Outlet tak jumpa: ${result.outlet}`,
      ITEM_NOT_FOUND  : `❌ Item tak jumpa: ${result.item} di ${result.outlet}`,
      DB_ERROR        : "❌ DB ERROR"
    };

    await reply(
      chatId,
      msgs[result.error] || "❌ ERROR"
    );

    return res.end();
  }

  // ======================
  // RESPONSE
  // ======================
  const lines = [
    result.updated.cost_price !== undefined
      ? `Cost   : RM${result.updated.cost_price}`
      : null,
    result.updated.min_qty !== undefined
      ? `Min Qty: ${result.updated.min_qty}`
      : null
  ]
  .filter(Boolean)
  .join("\n");

  await reply(
    chatId,
    `✅ UPDATED\nItem  : ${result.item}\nOutlet: ${result.outlet}\n${lines}`
  );

  return res.end();
});