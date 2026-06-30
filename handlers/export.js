const { withRole } = require("../core/withRole");
const { exportInventory } = require("../services/exports/exportInventory");
const { exportSummary }   = require("../services/exports/exportSummary");
const { exportFlow }      = require("../services/exports/exportFlow");
const { exportDetail }    = require("../services/exports/exportDetail");
const { exportDead }      = require("../services/exports/exportDead");
const { exportCompare }   = require("../services/exports/exportCompare");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getOutletByCode }  = require("../db/outlets/getOutletByCode");
const { getAllOutlets }     = require("../db/outlets/getAllOutlets");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");

const SUPPORTED_TYPES = ["INVENTORY", "SUMMARY", "FLOW", "DETAIL", "DEAD", "COMPARE"];

// COMPARE: owner & manager guna semua outlet — tiada outlet arg
const COMPARE_TYPE = "COMPARE";

const EXPORT_FN = {
  INVENTORY: exportInventory,
  SUMMARY:   exportSummary,
  FLOW:      exportFlow,
  DETAIL:    exportDetail,
  DEAD:      exportDead,
  COMPARE:   exportCompare
};

async function sendResult(reply, chatId, result, type) {
  if (result.error === "NO_DATA" || result.error === "NO_SNAPSHOT") {
    await reply(chatId, `📭 TIADA DATA: ${type}\nBulan lepas tiada rekod dijumpai.`);
    return;
  }
  if (result.error) {
    console.log(`EXPORT_${type}_ERROR:`, result.error);
    await reply(chatId, `❌ GAGAL EXPORT ${type}. Cuba lagi.`);
    return;
  }

  let msg = `📊 EXPORT ${type}\n${result.monthLabel}\n\n🔗 ${result.url}\n\n⏳ Link sah 1 jam.`;

  if (result.sheetCount > 1) {
    msg += `\n\n📋 ${result.sheetCount} outlet dalam fail ini.`;
  }
  if (result.noDataOutlets?.length) {
    msg += `\n\n⚠️ Tiada snapshot: ${result.noDataOutlets.join(", ")}`;
  }

  await reply(chatId, msg);
}

module.exports = withRole(["manager", "owner"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";
  const type         = parts[1]?.toUpperCase();
  const isCompare    = type === COMPARE_TYPE;

  // ======================
  // VALIDATE TYPE
  // ======================
  if (!type || !SUPPORTED_TYPES.includes(type)) {
    await reply(chatId,
      `❌ FORMAT: EXPORT [JENIS]\n\nJenis disokong:\n${SUPPORTED_TYPES.join(", ")}\n\n` +
      `Contoh:\nEXPORT INVENTORY\nEXPORT SUMMARY\nEXPORT COMPARE`
    );
    return res.end();
  }

  let outletIds, tenantId;

  // ======================
  // SUPERADMIN
  // ======================
  if (isSuperadmin) {

    if (isCompare) {
      // FORMAT: EXPORT COMPARE @slug
      const raw = parts[2];
      if (!raw?.startsWith("@")) {
        await reply(chatId, "❌ FORMAT: EXPORT COMPARE @<slug>");
        return res.end();
      }
      const { tenantId: t, error } = await parseSuperadminTarget(raw, true, null);
      if (error) { await reply(chatId, error); return res.end(); }
      tenantId = t;
      const { data: allOutlets } = await getAllOutlets(tenantId);
      outletIds = (allOutlets || []).map(o => o.id);

    } else {
      // FORMAT: EXPORT <TYPE> <outlet>@slug
      const raw = parts[2];
      if (!raw?.includes("@")) {
        await reply(chatId, `❌ FORMAT: EXPORT ${type} <outlet>@<slug>`);
        return res.end();
      }
      const { cleanValue: outletName, tenantId: t, error } = await parseSuperadminTarget(raw, true, null);
      if (error) { await reply(chatId, error); return res.end(); }
      tenantId = t;
      const outlet = await getOutletByCode(outletName, tenantId);
      if (!outlet) {
        await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
        return res.end();
      }
      outletIds = [outlet.id];
    }
  }

  // ======================
  // OWNER
  // ======================
  else if (user.role === "owner") {

    tenantId = user.tenant_id || null;

    if (isCompare) {
      // owner — semua outlet dalam tenant dia
      outletIds = await getAccessibleOutletIds(user);

    } else {
      // owner mesti specify outlet
      const outletName = parts[2];
      if (!outletName) {
        await reply(chatId, `❌ FORMAT: EXPORT ${type} <outlet>`);
        return res.end();
      }
      const outlet = await getOutletByCode(outletName, tenantId);
      if (!outlet) {
        await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
        return res.end();
      }
      const allIds = await getAccessibleOutletIds(user);
      if (!allIds.includes(outlet.id)) {
        await reply(chatId, "❌ NO ACCESS");
        return res.end();
      }
      outletIds = [outlet.id];
    }
  }

  // ======================
  // MANAGER — auto semua outlet dia
  // ======================
  else {
    tenantId  = user.tenant_id || null;
    outletIds = await getAccessibleOutletIds(user);
    if (!outletIds.length) {
      await reply(chatId, "❌ TIADA OUTLET DIBERI AKSES");
      return res.end();
    }
  }

  if (!outletIds?.length) {
    await reply(chatId, "❌ TIADA OUTLET UNTUK DI-EXPORT");
    return res.end();
  }

  // ======================
  // GENERATE
  // ======================
  const result = await EXPORT_FN[type]({ outletIds, tenantId, chatId });
  await sendResult(reply, chatId, result, type);
  return res.end();
});