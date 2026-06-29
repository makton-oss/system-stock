const { withRole } = require("../core/withRole");
const { exportInventoryForOutlet } = require("../services/exports/exportInventory");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getOutletById } = require("../db/outlets/getOutletById");
const { getOutletByCode } = require("../db/outlets/getOutletByCode");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");

const SUPPORTED_TYPES = ["INVENTORY"];

async function sendExportResult(reply, chatId, result) {

  if (result.error === "NO_SNAPSHOT") {
    await reply(chatId, `📭 TIADA SNAPSHOT: ${result.outletName} (bulan lepas)`);
    return;
  }

  if (result.error) {
    await reply(chatId, `❌ GAGAL EXPORT: ${result.outletName}`);
    return;
  }

  await reply(
    chatId,
    `📊 INVENTORY REPORT ${result.monthName.toUpperCase()} ${result.outletName.toUpperCase()}\n\n` +
    `${result.url}\n\n⏳ Link sah selama 1 jam.`
  );
}

// ======================
// manager & owner sahaja — superadmin tetap dapat masuk
// sebab withRole.js bypass automatik role check untuk superadmin
// ======================
module.exports = withRole(["manager", "owner"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  const type = parts[1]?.toUpperCase();

  if (!type || !SUPPORTED_TYPES.includes(type)) {
    await reply(chatId, `❌ FORMAT: EXPORT INVENTORY\n\nJenis disokong: ${SUPPORTED_TYPES.join(", ")}`);
    return res.end();
  }

  // ======================
  // MANAGER — loop semua outlet dia manage
  // ======================
  if (!isSuperadmin && user.role === "manager") {

    const outletIds = await getAccessibleOutletIds(user);

    if (!outletIds.length) {
      await reply(chatId, "❌ TIADA OUTLET DIBERI AKSES");
      return res.end();
    }

    for (const outletId of outletIds) {
      const outlet = await getOutletById(outletId, user.tenant_id || null);
      if (!outlet) continue;

      const result = await exportInventoryForOutlet({ outlet, tenantId: user.tenant_id || null });
      await sendExportResult(reply, chatId, result);
    }

    return res.end();
  }

  // ======================
  // OWNER — wajib specify outlet (elak flood)
  // ======================
  if (!isSuperadmin) {

    const outletName = parts[2];

    if (!outletName) {
      await reply(chatId, "❌ FORMAT: EXPORT INVENTORY <outlet>");
      return res.end();
    }

    const tenantId = user.tenant_id || null;
    const outlet   = await getOutletByCode(outletName, tenantId);

    if (!outlet) {
      await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
      return res.end();
    }

    const outletIds = await getAccessibleOutletIds(user);
    if (!outletIds.includes(outlet.id)) {
      await reply(chatId, "❌ NO ACCESS");
      return res.end();
    }

    const result = await exportInventoryForOutlet({ outlet, tenantId });
    await sendExportResult(reply, chatId, result);
    return res.end();
  }

  // ======================
  // SUPERADMIN — wajib outlet@slug
  // ======================
  const raw = parts[2];

  if (!raw || !raw.includes("@")) {
    await reply(chatId, "❌ FORMAT: EXPORT INVENTORY <outlet>@<slug>");
    return res.end();
  }

  const { cleanValue: outletName, tenantId, error: slugError } = await parseSuperadminTarget(
    raw,
    true,
    null
  );

  if (slugError) {
    await reply(chatId, slugError);
    return res.end();
  }

  const outlet = await getOutletByCode(outletName, tenantId);

  if (!outlet) {
    await reply(chatId, `❌ OUTLET TAK WUJUD: ${outletName}`);
    return res.end();
  }

  const result = await exportInventoryForOutlet({ outlet, tenantId });
  await sendExportResult(reply, chatId, result);
  return res.end();
});