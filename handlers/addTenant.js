const { withRole } = require("../core/withRole");
const { createTenant, PLAN_CONFIG } = require("../db/tenants/createTenant");
const { writeLog } = require("../utils/formatter");

const VALID_PLANS = Object.keys(PLAN_CONFIG);

module.exports = withRole(["admin"], async (ctx) => {

  const { chatId, user, parts, reply, res } = ctx;

  if (user.role !== "superadmin") {
    await reply(chatId, "❌ NO ACCESS");
    return res.end();
  }

  // FORMAT: ADDTENANT slug plan maintenance(y/n) brand Nama Syarikat Sdn Bhd
  if (parts.length < 6) {
    await reply(chatId,
      "❌ FORMAT: ADDTENANT slug plan maintenance brand Nama Syarikat\n\n" +
      "Contoh:\nADDTENANT abc starter y Nike Syarikat ABC Sdn Bhd\n\n" +
      "Plan tersedia:\n" +
      VALID_PLANS.map(p => `• ${p} — max ${PLAN_CONFIG[p].max_users} users`).join("\n") +
      "\n\nMaintenance: y = ada, n = tiada"
    );
    return res.end();
  }

  const slug        = parts[1].toLowerCase();
  const plan        = parts[2].toLowerCase();
  const maintenance = parts[3].toLowerCase();
  const brand       = parts[4];
  const name        = parts.slice(5).join(" ");

  // Validate slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    await reply(chatId, "❌ Slug mesti lowercase, alphanumeric dan dash sahaja.\nContoh: kedai-maju");
    return res.end();
  }

  if (!VALID_PLANS.includes(plan)) {
    await reply(chatId, `❌ Plan tidak sah: ${plan}\n\nPlan tersedia: ${VALID_PLANS.join(", ")}`);
    return res.end();
  }

  if (!["y", "n"].includes(maintenance)) {
    await reply(chatId, "❌ Maintenance mesti y atau n");
    return res.end();
  }

  if (!name) {
    await reply(chatId, "❌ Nama syarikat diperlukan");
    return res.end();
  }

  const hasMaintenance = maintenance === "y";

  const result = await createTenant({ name, slug, plan, brand, hasMaintenance });

  if (result.error === "SLUG_TAKEN") {
    await reply(chatId, `❌ Slug sudah digunakan: ${slug}`);
    return res.end();
  }

  if (result.error) {
    await reply(chatId, "❌ DB ERROR");
    return res.end();
  }

  const config = PLAN_CONFIG[plan];

  await writeLog(chatId, "superadmin", "ADDTENANT", `${slug} | ${plan} | maintenance:${maintenance} | ${name}`);

  await reply(chatId,
    `✅ TENANT CREATED\n\n` +
    `Syarikat    : ${name}\n` +
    `Slug        : ${slug}\n` +
    `Brand       : ${brand}\n` +
    `Plan        : ${plan}\n` +
    `Max Users   : ${config.max_users}\n` +
    `Report      : ${config.can_report ? "✅" : "❌"}\n` +
    `Maintenance : ${hasMaintenance ? "✅" : "❌"}`
  );

  return res.end();
});