const { withRole } = require("../core/withRole");
const supabase = require("../services/db");
const { approveRequests } = require("../services/approveService");
const { writeLog, formatLowStockAlert } = require("../utils/formatter");
const { notifyManagers } = require("../utils/helpers");
const { getAccessibleOutletIds } = require("../utils/getAccessibleOutlets");

module.exports = withRole(["manager"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const raw = parts.join(" ");

	const isAll = raw.startsWith("APPROVE_ALL_");

	let targetOutletId = null;

	if (isAll) {
	  targetOutletId = Number(
		raw.replace("APPROVE_ALL_", "")
	  );
	}

  const outletIds = await getAccessibleOutletIds(user);

  let query = supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .in("outlet_id", outletIds);

  if (!isAll) {

	  const id = Number(parts[1]);

	  if (isNaN(id)) {
		await reply(chatId, "❌ FORMAT: APPROVE 12");
		return res.end();
	  }

	  query = query.eq("id", id);

	} else {

	  if (isNaN(targetOutletId)) {
		await reply(chatId, "❌ INVALID OUTLET");
		return res.end();
	  }

	  query = query.eq("outlet_id", targetOutletId);
	}

  const { data: rows, error } = await query;

  if (error) {
    console.log("APPROVE FETCH ERROR:", error);
    await reply(chatId, "❌ ERROR");
    return res.end();
  }

  if (!rows?.length) {
    await reply(chatId, "📭 TIADA DATA");
    return res.end();
  }

  const { summary, logDetails, rows: processed } =
    await approveRequests(rows, chatId);

  for (const r of processed) {
    if (!r._lowStock) continue;

    const alertText = formatLowStockAlert(
      r._lowStock.item,
      r._lowStock.qty,
      r._lowStock.min
    );

    await notifyManagers(alertText, r._lowStock.outlet_id);
  }

  let text = "✅ APPROVED\n\n";

  Object.entries(summary).forEach(([i, q]) => {
    text += `${i} ${q > 0 ? "+" : ""}${q}\n`;
  });

  await writeLog(chatId, "manager", "APPROVE", logDetails.join(" | "));
  await reply(chatId, text);

  return res.end();
});