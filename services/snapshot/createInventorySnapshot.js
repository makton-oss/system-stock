const supabase = require("../db");
const { DateTime } = require("luxon");

async function createInventorySnapshot()
{
  const snapshotDate =
    DateTime
      .now()
      .setZone("Asia/Kuala_Lumpur")
      .toFormat("yyyy-MM-dd");

  const { data: stocks, error } =
    await supabase
      .from("stock")
      .select(`
        qty,
        outlet_id,
        item_id,
        item,
        stock_items(
          cost_price
        )
      `);

  if (error)
  {
    console.log(error);
    return;
  }

  const rows =
    stocks.map(stock =>
    {
      const costPrice =
        Number(
          stock.stock_items?.cost_price || 0
        );

      return {
        snapshot_date: snapshotDate,

        outlet_id: stock.outlet_id,

        item_id: stock.item_id,

        item_name: stock.item,

        qty: stock.qty,

        cost_price: costPrice,

        inventory_value:
          Number(stock.qty) * costPrice
      };
    });

  const { error: saveError } =
    await supabase
      .from("stock_snapshots")
      .upsert(
        rows,
        {
          onConflict:
            "snapshot_date,outlet_id,item_id"
        }
      );

  if (saveError)
  {
    console.log(saveError);
    return;
  }

  console.log(
    `✅ SNAPSHOT SAVED (${snapshotDate})`
  );
}

module.exports =
  createInventorySnapshot;