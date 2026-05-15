const supabase = require("./db");
const { parseMonthInput, toProperCase } = require("../utils/formatter");

async function generateReport(monthInput, outletId) {

  const range = parseMonthInput(monthInput);

  if (!range) {
    return { error: "INVALID_FORMAT" };
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();

  // ======================
  // PARALLEL FETCH
  // ======================
  const results = await Promise.all([
    supabase.rpc("get_inventory_value_by_date", {
      p_start: start,
      p_end: end,
      p_outlet_id: outletId
    }),
    supabase.rpc("get_fast_moving_by_date", {
      p_start: start,
      p_end: end
    }),
    supabase.rpc("get_slow_moving_by_date", {
      p_start: start,
      p_end: end
    }),
    supabase.rpc("get_dead_stock_by_date", {
      p_start: start,
      p_end: end
    }),
    supabase.rpc("get_monthly_trend_by_date", {
      p_start: start,
      p_end: end
    })
  ]);

  // ======================
  // ERROR CHECK
  // ======================
  for (const r of results) {
    if (r.error) {
      console.log("REPORT ERROR:", r.error);
      return { error: "DB_ERROR" };
    }
  }

  const [inventory, fast, slow, dead, trend] = results;

  // ======================
  // FORMAT TEXT
  // ======================
  let text = `📊 MONTHLY REPORT\n${monthInput.toUpperCase()}\n\n`;

  // INVENTORY VALUE
  let total = 0;
  text += "💰 INVENTORY VALUE\n\n";

  (inventory.data || []).forEach(r => {
    total += Number(r.total_value);

    text += `${toProperCase(r.item)} x ${r.qty} RM${Number(r.total_value).toFixed(2)}\n`;
  });

  text += `TOTAL: RM${total.toFixed(2)}\n\n`;

  // FAST
  text += "🔥 FAST MOVING\n\n";
  (fast.data || []).forEach((r, i) => {
    text += `${i + 1}. ${toProperCase(r.item)} Used: ${r.total_out}\n\n`;
  });

  // SLOW
  text += "🐢 SLOW MOVING\n\n";
  (slow.data || []).forEach((r, i) => {
    text += `${i + 1}. ${toProperCase(r.item)} Used: ${r.total_out}\n\n`;
  });

  // DEAD
  text += "💀 DEAD STOCK\n\n";
  (dead.data || []).forEach(r => {
    text += `${toProperCase(r.item)} Balance: ${r.qty}\n\n`;
  });

  // TREND
  text += "📈 MONTHLY TREND\n\n";
  (trend.data || []).forEach(r => {
    text += `${toProperCase(r.item)} OUT: ${r.total_out}\n\n`;
  });

  return { text };
}

module.exports = { generateReport };