const { withRole } = require("../core/withRole");
const { parseUpItem } = require("../utils/parseUpdateItems");
const { updateStockItem } = require("../services/stock/updateItem");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  const FORMAT_MSG = isSuperadmin
    ? `❌ FORMAT:\nUPDATEITEM ayam rempah cost 3.5 outlet_a@slug\nUPDATEITEM ayam rempah min 5 outlet_a@slug\nUPDATEITEM ayam rempah cost 3.5 min 5 outlet_a@slug`
    : `❌ FORMAT:\nUPDATEITEM ayam rempah cost 3.5 muiz\nUPDATEITEM ayam rempah min 5 muiz\nUPDATEITEM ayam rempah cost 3.5 min 5 muiz`;

  // ======================
  // PARSE (outletName masih raw e.g. "outlet_a@slug")
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
    await reply(chatId, msgs[parsed.error] || FORMAT_MSG);
    return res.end();
  }

  // ======================
  // RESOLVE @slug dari outletName
  // ======================
  const { cleanValue: outletName, tenantId, error: slugError } = await parseSuperadminTarget(
    parsed.outletName,
    isSuperadmin,
    user.tenant_id || null
  );

  if (slugError) {
    await reply(chatId, slugError);
    return res.end();
  }

  // ======================
  // SERVICE
  // ======================
  const result = await updateStockItem({
    item: parsed.item,
    outletName,
    updates: parsed.updates,
    tenantId
  });

  if (result.error) {
    const msgs = {
      OUTLET_NOT_FOUND: `❌ Outlet tak jumpa: ${result.outlet}`,
      ITEM_NOT_FOUND  : `❌ Item tak jumpa: ${result.item} di ${result.outlet}`,
      DB_ERROR        : "❌ DB ERROR"
    };
    await reply(chatId, msgs[result.error] || "❌ ERROR");
    return res.end();
  }

  // ======================
  // RESPONSE
  // ======================
  const lines = [
    result.updated.cost_price !== undefined ? `Cost   : RM${result.updated.cost_price}` : null,
    result.updated.min_qty    !== undefined ? `Min Qty: ${result.updated.min_qty}`      : null
  ]
  .filter(Boolean)
  .join("\n");

  await reply(chatId, `✅ UPDATED\nItem  : ${result.item}\nOutlet: ${result.outlet}\n${lines}`);
  return res.end();
});