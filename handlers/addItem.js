const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { normalizeItem } = require("../utils/helpers");

module.exports = withRole(["admin"], async (ctx) => {
  const { chatId, parts, reply, res } = ctx;

  // ======================
  // MIN ARG CHECK
  // ======================
  if (parts.length < 7) {
    await reply(chatId, "❌ FORMAT: ADDITEM ayam dara basah 10 3.4 ketul muiz");
    return res.end();
  }

  // ======================
  // PARSE INPUT
  // ======================
  const outletName = parts.at(-1);
  const uom = parts.at(-2);
  const cost = parseFloat(parts.at(-3));
  const minQty = parseInt(parts.at(-4));
  const category = parts.at(-5);

  const itemNameRaw = parts.slice(1, -5).join(" ");
  const item = normalizeItem(itemNameRaw);
  
  console.log("RAW PARTS:", parts);
	console.log("PARSED:", {
	  itemNameRaw,
	  item,
	  category,
	  minQty,
	  cost,
	  uom,
	  outletName
	});

  if (!item || !category || isNaN(minQty) || isNaN(cost) || !uom || !outletName) {
    await reply(chatId, "❌ FORMAT: ADDITEM ayam dara basah 10 3.4 ketul muiz");
    return res.end();
  }

  // ======================
  // GET OUTLET ID
  // ======================
  const { data: outlet, error: outletError } = await supabase
    .from("outlets")
    .select("id, name")
    .ilike("name", outletName)
    .maybeSingle();

  if (outletError || !outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  // ======================
  // INSERT STOCK ITEM (MASTER)
  // ======================
  const { data: itemRow, error: itemError } = await supabase
    .from("stock_items")
    .insert({
      name: item,
      category,
      min_qty: minQty,
      cost_price: cost,
      uom
    })
    .select()
    .single();

  if (itemError) {
    console.log("ITEM INSERT ERROR:", itemError);
    await reply(chatId, "❌ DB ERROR (ITEM)");
    return res.end();
  }
  
  const { data: exist } = await supabase
	  .from("stock_items")
	  .select("id")
	  .eq("name", item)
	  .maybeSingle();

	if (exist) {
	  await reply(chatId, `❌ ITEM DAH WUJUD: ${item}`);
	  return res.end();
	}

  // ======================
  // INSERT STOCK (PER OUTLET)
  // ======================
  const { error: stockError } = await supabase
    .from("stock")
    .insert({
      item: item,
      item_id: itemRow.id,
      outlet_id: outlet.id,
      qty: 0,
      min_qty: minQty
    });

  if (stockError) {
    console.log("STOCK INSERT ERROR:", stockError);
    await reply(chatId, "❌ DB ERROR (STOCK)");
    return res.end();
  }

  // ======================
  // SUCCESS RESPONSE
  // ======================
  await reply(
    chatId,
    `✅ ITEM ADDED

${item}
Outlet: ${outlet.name}
Category: ${category}
Min: ${minQty}
Cost: RM${cost}
UOM: ${uom}`
  );

  return res.end();
});