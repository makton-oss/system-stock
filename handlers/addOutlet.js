const { withRole } = require("../core/withRole");
const { createOutlet } = require("../db/outlets/createOutlet");
const { parseSuperadminTarget } = require("../utils/parseSuperadminTarget");
const { writeLog } = require("../utils/formatter");
const { normalizeItem } = require("../utils/helpers");

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, user, parts, reply, res } = ctx;
  const isSuperadmin = user.role === "superadmin";

  if (parts.length < 2) {
    await reply(chatId, isSuperadmin
      ? "❌ FORMAT: ADDOUTLET nama_outlet@slug"
      : "❌ FORMAT: ADDOUTLET nama_outlet"
    );
    return res.end();
  }

  const rawOutlet = parts.slice(1).join(" ");

  const { cleanValue: outletRaw, tenantId, error: slugError } = await parseSuperadminTarget(
    rawOutlet,
    isSuperadmin,
    user.tenant_id || null
  );

  if (slugError) {
    await reply(chatId, slugError);
    return res.end();
  }

  if (!tenantId) {
    await reply(chatId, "❌ Tenant tidak dijumpai");
    return res.end();
  }

  // normalizeItem: lowercase + trim + collapse spaces + remove dash
  // suitable for outlet names since outlets follow same convention
  const name = normalizeItem(outletRaw);

  if (!name || name.length < 2) {
    await reply(chatId, "❌ Nama outlet terlalu pendek");
    return res.end();
  }

  const result = await createOutlet({ name, tenantId });

  if (result.error === "OUTLET_EXISTS") {
    await reply(chatId, `❌ Outlet sudah wujud: ${name}`);
    return res.end();
  }

  if (result.error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  try {
    await writeLog(chatId, user.role, "ADDOUTLET", `${name} | tenant: ${tenantId}`);
  } catch (err) {
    console.log("WRITELOG ERROR:", err);
  }

  await reply(chatId,
    `✅ OUTLET CREATED\n\n` +
    `Nama : ${result.outlet.name}\n` +
    `ID   : ${result.outlet.id}`
  );

  return res.end();
});