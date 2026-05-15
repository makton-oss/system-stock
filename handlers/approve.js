const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { approveRequests } = require("../services/approveService");
const { writeLog, formatLowStockAlert } = require("../utils/formatter");
const { notifyManagers } = require("../utils/helpers");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const arg = parts[1]?.toUpperCase();

  // ======================
  // 🔥 STEP 1: LOCK (pending → processing)
  // ======================
  if (arg === "ALL") {

    await supabase
      .from("requests")
      .update({ status: "processing" })
      .eq("status", "pending")
      .eq("outlet_id", user.outlet_id);

  } else {

    const id = parseInt(parts[1]);

    if (isNaN(id)) {
      await reply(chatId, "❌ FORMAT: APPROVE ALL / APPROVE 12");
      return res.end();
    }

    await supabase
      .from("requests")
      .update({ status: "processing" })
      .eq("id", id)
      .eq("status", "pending");

  }

  // ======================
  // 🔥 STEP 2: FETCH (processing sahaja)
  // ======================
  let query = supabase
    .from("requests")
    .select("*")
    .eq("status", "processing")
    .eq("outlet_id", user.outlet_id);

  if (arg !== "ALL") {
    const id = parseInt(parts[1]);
    query = query.eq("id", id);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.log("APPROVE ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  if (!rows?.length) {
    await reply(chatId, "📭 SUDAH PROSES");
    return res.end();
  }

  // ======================
  // 🔥 STEP 3: PROCESS
  // ======================
  const { summary, logDetails, rows: processed } =
    await approveRequests(rows, chatId);

  // ======================
  // 🔥 STEP 4: LOW STOCK ALERT
  // ======================
  for (const r of processed) {

    if (!r._lowStock) continue;

    const alertText = formatLowStockAlert(
      r._lowStock.item,
      r._lowStock.qty,
      r._lowStock.min
    );

    await notifyManagers(
      alertText,
      r._lowStock.outlet_id
    );
  }

  // ======================
  // 🔥 STEP 5: RESPONSE
  // ======================
  let text = "✅ APPROVED\n\n";

  Object.entries(summary).forEach(([i, q]) => {
    text += `${i} ${q > 0 ? "+" : ""}${q}\n`;
  });

  await writeLog(chatId, "manager", "APPROVE", logDetails.join(" | "));
  await reply(chatId, text);

  return res.end();
});