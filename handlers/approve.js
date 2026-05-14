const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { approveRequests } = require("../services/approveService");
const { writeLog, formatLowStockAlert } = require("../utils/formatter");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const arg = parts[1]?.toUpperCase();

  // ======================
  // FETCH REQUEST
  // ======================
  let query = supabase
    .from("requests")
    .update({ status: "processing" })
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

  const { data: rows } = await query.select();

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
    if (r._lowStock) {
      await reply(
        chatId,
        formatLowStockAlert(
          r._lowStock.item,
          r._lowStock.qty,
          r._lowStock.min
        )
      );
    }
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