const { withRole } = require("../core/withRole");
const { getMainReport, getInventoryReport, getFlowReport, getDeadReport, getDetailReport } = require("../services/reportService");
const { formatSummaryReport, formatInventoryReport, formatDetailReport, formatDeadReport, formatFlowReport, parseMonthInput, formatMonthLabel  } = require("../utils/formatter");
const { getSummaryReport } = require("../services/reports/summaryReport");

module.exports = withRole(["manager", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  // ======================
  // MODE DETECTION
  // ======================
  let mode = parts[1]?.toUpperCase();
  
  if (mode === "SUMMARY") {
	  mode = undefined;
	}

  // ======================
  // ROLE CONTROL
  // ======================

  const isAdmin =
    user.role === "admin";

  const outletIds =
    isAdmin
      ? null
      : (user.accessible_outlets || []);

  if (!isAdmin && !outletIds.length) {

    await reply(
      chatId,
      "❌ TIADA AKSES OUTLET"
    );

    return res.end();
  }

  // ======================
  // INVENTORY MODE
  // ======================

  if (mode === "INVENTORY") {

    const rawDate =
      parts[2];

    if (!rawDate) {

      await reply(
        chatId,
        "❌ FORMAT: REPORT INVENTORY 30/04/26"
      );

      return res.end();
    }

    const match =
      rawDate.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/
      );

    if (!match) {

      await reply(
        chatId,
        "❌ FORMAT TARIKH: 30/04/26"
      );

      return res.end();
    }

    const [
      ,
      dd,
      mm,
      yy
    ] = match;

    const snapshotDate =
      `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;

    try {

      const result =
        await getInventoryReport({
          outletIds,
          snapshotDate
        });

      if (result.error) {
        throw result.error;
      }

      await reply(
        chatId,
        formatInventoryReport(
          result,
          rawDate
        )
      );

      return res.end();

    } catch (err) {

      console.log(
        "REPORT ERROR:",
        err
      );

      await reply(
        chatId,
        "❌ REPORT ERROR"
      );

      return res.end();
    }
  }

  const COMMANDS = ["FLOW", "DEAD", "DETAIL"];

  // ======================
  // MONTH PARSE FIX
  // ======================
  let monthInput = "current";

  if (COMMANDS.includes(mode) ||
	mode === undefined
  ) {
    // contoh: REPORT FLOW may-26
    monthInput = parts[2] || "current";
  } else {
    // contoh: REPORT may-26
    monthInput = parts[1] || "current";
  }

  const range = parseMonthInput(monthInput);

  if (!range) {
    await reply(chatId, "❌ FORMAT: REPORT may-26");
    return res.end();
  }

  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const monthLabel = formatMonthLabel(monthInput, start);

  // ======================
  // ROUTING
  // ======================
  try {

    let result;

    switch (mode) {

      case "FLOW":
        result = await getFlowReport({ start, end, outletIds });

        if (result.error) throw result.error;

        await reply(chatId, formatFlowReport(result, monthLabel));
        return res.end();


      case "DEAD":
        result = await getDeadReport({ start, end, outletIds  });      

        if (result.error) throw result.error;

        const hasDead = Object.values(result)
		  .some(arr => arr.length);

		if (!hasDead) {
		  await reply(
			chatId,
			"✅ TIADA STOCK YANG TIDAK BERGERAK 60 HARI SEBELUM INI."
		  );
		  return res.end();
		}

        await reply(chatId, formatDeadReport(result, monthLabel));
        return res.end();


      case "DETAIL":
        result = await getDetailReport({ start, end, outletIds });

        if (result.error) throw result.error;

        const hasData = Object.values(result)
		  .some(arr => arr.length);

		if (!hasData) {
		  await reply(chatId, "📭 TIADA DATA");
		  return res.end();
		}

        await reply(chatId, formatDetailReport(result, monthLabel));
        return res.end();


      default:
        // MAIN REPORT
        result = await getSummaryReport({
          start,
          end,
          outletIds,
        });

        if (result.error) throw result.error;

        await reply(
          chatId,
          formatSummaryReport(result, monthLabel)
        );

        return res.end();
    }

  } catch (err) {

    console.log("REPORT ERROR:", err);

    await reply(chatId, "❌ REPORT ERROR");
    return res.end();
  }
});