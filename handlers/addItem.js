const { withRole } = require("../core/withRole");
const { normalizeItem } = require("../utils/helpers");
const { getOutletByCode } = require("../db/outlets/getOutletByCode");
const { addStockItem } = require("../services/stock/addStockItem");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  if (parts.length < 7) {
    await reply(chatId, isSuperadmin
      ? "❌ FORMAT: ADDITEM ayam dara basah kering 10 3.4 ketul outlet_a@slug"
      : "❌ FORMAT: ADDITEM ayam dara basah kering 10 3.4 ketul outlet_a"
    );
    return res.end();
  }

  // Parse outlet + @slug (superadmin sahaja)
  // parts.at(-1) = "outlet_a" atau "outlet_a@slug"
  const { cleanValue: outletName, tenantId, error: slugError } = await parseSuperadminTarget(
    parts.at(-1),
    isSuperadmin,
    user.tenant_id || null
  );

  if (slugError) {
    await reply(chatId, slugError);
    return res.end();
  }

  // ======================
  // PARSE INPUT
  // ======================
  const uom         = parts.at(-2);
  const cost        = parseFloat(parts.at(-3));
  const minQty      = parseInt(parts.at(-4));
  const category    = parts.at(-5);
  const itemNameRaw = parts.slice(1, -5).join(" ");
  const item        = normalizeItem(itemNameRaw);

  if (!item || !category || isNaN(minQty) || isNaN(cost) || !uom || !outletName) {
    await reply(chatId, isSuperadmin
      ? "❌ FORMAT: ADDITEM ayam dara basah kering 10 3.4 ketul outlet_a@slug"
      : "❌ FORMAT: ADDITEM ayam dara basah kering 10 3.4 ketul outlet_a"
    );
    return res.end();
  }

  // ======================
  // GET OUTLET (scoped to tenant)
  // ======================
  const outlet = await getOutletByCode(outletName, tenantId);
  if (!outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  // ======================
  // ADD ITEM (shared service — sama logic dgn scripts/bulkImportItems.js)
  // ======================
  const result = await addStockItem({ item, category, minQty, cost, uom, outlet, tenantId });

  if (result.error === "STOCK_EXISTS") {
    await reply(chatId, `⚠️ ITEM DAH ADA DI OUTLET`);
    return res.end();
  }

  if (result.error) {
    await reply(chatId, `❌ DB ERROR (${result.error})`);
    return res.end();
  }

  await reply(chatId, `✅ ITEM ADDED\n\n${item}\nOutlet: ${outlet.name}\nCategory: ${category}\nMin: ${minQty}\nCost: RM${cost}\nUOM: ${uom}`);
  return res.end();
});