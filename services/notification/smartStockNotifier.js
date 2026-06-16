const supabase = require("../db");
const { toProperCase } = require("../../utils/formatter");
const { sendButtons } = require("./buttonService");
const { getManagersByOutlet } = require("../../db/users/getManagersByOutlet");
const { buildStockRequestMessage } = require("../../utils/messages/buildStockRequestMessage");
const { applyTenant } = require("../../utils/applyTenant");

async function notifySmartStock(outletId, tenantId = null) {

  console.log("NOTIFY OUTLET:", outletId);

  let q = supabase
    .from("requests")
    .select(`
      id,
      item,
      qty,
      type,
      created_at,
      requested_by,
      outlets(name),
      users(nickname, chat_id)
    `)
    .eq("status", "pending")
    .eq("outlet_id", outletId);

  q = applyTenant(q, tenantId);

  const { data: rows } = await q;

  if (!rows?.length) return;

  const managers = await getManagersByOutlet(outletId, tenantId);

  const { data: outlet } = await supabase
    .from("outlets")
    .select("name")
    .eq("id", outletId)
    .maybeSingle();

  const outletName = toProperCase(outlet?.name || "Outlet");

  // ======================
  // SINGLE
  // ======================
  if (rows.length === 1) {

    const r = rows[0];

    const text = buildStockRequestMessage({ outletName, rows });

    for (let m of managers) {

      const buttons = [
        { id: `approve ${r.id}`, title: `APPROVE ${r.id}` },
        { id: `reject ${r.id}`,  title: `REJECT ${r.id}`  }
      ];

      await sendButtons(m.chat_id, text, buttons);
    }

    return;
  }

  // ======================
  // MULTI
  // ======================
  const text = buildStockRequestMessage({ outletName, rows });

  for (let m of managers) {

    await sendButtons(
      m.chat_id,
      text,
      [
        { id: `approve_all_${outletId}`, title: `APPROVE ${outletName.toUpperCase()}` },
        { id: `reject_all_${outletId}`,  title: `REJECT ${outletName.toUpperCase()}`  }
      ]
    );
  }
}

module.exports = { notifySmartStock };