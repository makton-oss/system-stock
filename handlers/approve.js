const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { approveRequests } = require("../services/approveService");
const { writeLog, formatLowStockAlert } = require("../utils/formatter");
const { notifyManagers } = require("../utils/helpers");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const arg = parts[1]?.toUpperCase();

  // ======================
  // FETCH PENDING ONLY (OUTLET BASED)
  // ======================
  let query = supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .eq("outlet_id", user.outlet_id);

  if (arg !== "ALL") {
    const id = parseInt(parts[1]);

    if (isNaN(id)) {
      await reply(chatId, "❌ FORMAT: APPROVE ALL / APPROVE 12");
      return res.end();
    }

    query = query.eq("id", id);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.log("APPROVE ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  if (!rows?.length) {
    await reply(chatId, "📭 TIADA DATA");
    return res.end();
  }

  // ======================
  // PROCESS
  // ======================
  const { summary, logDetails, rows: processed } =
    await approveRequests(rows, chatId);

  // ======================
  // LOW STOCK ALERT
  // ======================
  for (const r of processed) {
    if (!r._lowStock) continue;

    const alertText = formatLowStockAlert(
      r._lowStock.item,
      r._lowStock.qty,
      r._lowStock.min
    );

    await notifyManagers(alertText, r._lowStock.outlet_id);
  }

  // ======================
  // RESPONSE
  // ======================
  let text = "✅ APPROVED\n\n";

  Object.entries(summary).forEach(([i, q]) => {
    text += `${i} ${q > 0 ? "+" : ""}${q}\n`;
  });

  await writeLog(chatId, "manager", "APPROVE", logDetails.join(" | "));
  await reply(chatId, text);

  return res.end();
});