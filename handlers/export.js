const { withRole } = require("../core/withRole");
const { getAccessibleOutletIds } = require("../db/outlets/getAccessibleOutletIds");
const { getTenantBySlug } = require("../db/tenants/getTenantBySlug");
const { exportMonthlyFull } = require("../services/exports/exportMonthlyFull");

module.exports = withRole(["manager", "owner", "admin"], async (ctx) => {

  const { chatId, parts, user, reply, res } = ctx;

  const isSuperadmin = user.role === "superadmin";
  const isAdmin      = user.role === "admin" || isSuperadmin;
  const tenantId     = user.tenant_id || null;

  // ======================
  // VALIDATE COMMAND
  // FORMAT:
  //   EXPORT FULL [bulan]           ← manager/owner/admin
  //   EXPORT FULL @slug [bulan]     ← superadmin
  // ======================
  const first = parts[1]?.toUpperCase();

  if (first !== "FULL") {
    const fmt = isSuperadmin
      ? "❌ FORMAT: EXPORT FULL @slug [bulan]\n\nContoh:\nEXPORT FULL @kedaimaju\nEXPORT FULL @kedaimaju may-26"
      : "❌ FORMAT: EXPORT FULL [bulan]\n\nContoh:\nEXPORT FULL\nEXPORT FULL may-26";
    await reply(chatId, fmt);
    return res.end();
  }

  // ======================
  // SUPERADMIN — wajib @slug
  // ======================
  let resolvedTenantId = tenantId;
  let resolvedOutletIds;
  let monthArg;

  if (isSuperadmin) {
    const slugArg = parts[2];
    if (!slugArg?.startsWith("@")) {
      await reply(chatId, "❌ FORMAT: EXPORT FULL @slug [bulan]\n\nContoh:\nEXPORT FULL @kedaimaju\nEXPORT FULL @kedaimaju may-26");
      return res.end();
    }

    const slug   = slugArg.slice(1);
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      await reply(chatId, `❌ TENANT TAK WUJUD: ${slug}`);
      return res.end();
    }

    resolvedTenantId  = tenant.id;
    resolvedOutletIds = null; // semua outlet dalam tenant
    monthArg          = parts[3]?.toLowerCase();

  } else if (isAdmin) {
    // Admin tenant-scoped — semua outlet dalam tenant
    resolvedOutletIds = null;
    monthArg          = parts[2]?.toLowerCase();

  } else {
    // Manager / Owner — outlet yang accessible je
    resolvedOutletIds = await getAccessibleOutletIds(user);
    if (!resolvedOutletIds?.length) {
      await reply(chatId, "❌ TIADA AKSES OUTLET");
      return res.end();
    }
    monthArg = parts[2]?.toLowerCase();
  }

  const mode = monthArg ? "monthly" : "dayrange";

  // ======================
  // GENERATE
  // ======================
  await reply(chatId, "⏳ Sedang menjana laporan Excel... Sila tunggu.");

  try {
    const result = await exportMonthlyFull({
      outletIds:  resolvedOutletIds,
      tenantId:   resolvedTenantId,
      chatId,
      monthInput: monthArg,
      mode
    });

    if (result.error === "INVALID_MONTH") {
      await reply(chatId, "❌ FORMAT BULAN SALAH\n\nContoh: EXPORT FULL may-26");
      return res.end();
    }

    if (result.error === "BUCKET_ERROR") {
      await reply(chatId, "❌ STORAGE ERROR. Cuba lagi.");
      return res.end();
    }

    if (result.error) throw result.error;

    await reply(chatId,
      `📊 EXPORT FULL\n${result.monthLabel}\n\n` +
      `🔗 ${result.url}\n\n` +
      `📋 ${result.sheetCount} sheet dalam fail ini.\n` +
      `⏳ Link sah 1 jam.`
    );

  } catch (err) {
    console.log("EXPORT FULL ERROR:", err);
    await reply(chatId, "❌ EXPORT GAGAL. Cuba lagi.");
  }

  return res.end();
});