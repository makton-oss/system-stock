const supabase = require("../db");
const { toProperCase } = require("../../utils/formatter");
const { sendButtons } = require("./buttonService");
const { getManagersByOutlet } = require("../../utils/getManagersByOutlet");
const { buildStockRequestMessage } = require("../../utils/messages/buildStockRequestMessage");

// ======================
// NOTIFY SMART
// ======================

async function notifySmartStock(
  outletId
) {

  console.log(
    "NOTIFY OUTLET:",
    outletId
  );

  const { data: rows } =
    await supabase
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

  if (!rows?.length) {
    return;
  }

  const managers =
    await getManagersByOutlet(
      outletId
    );

  const { data: outlet } =
    await supabase
      .from("outlets")
      .select("name")
      .eq("id", outletId)
      .maybeSingle();

  const outletName =
    toProperCase(
      outlet?.name || "Outlet"
    );

  // ======================
  // SINGLE
  // ======================

  if (rows.length === 1) {

  const r = rows[0];

  const text =
    buildStockRequestMessage({
      outletName,
      rows
    });

  console.log(
    "MANAGERS:",
    managers
  );

  console.log(
    "BUTTON TEXT:",
    text
  );

  for (let m of managers) {

    const buttons = [
      {
        id:
          `approve ${r.id}`,

        title:
          `APPROVE ${r.id}`
      },
      {
        id:
          `reject ${r.id}`,

        title:
          `REJECT ${r.id}`
      }
    ];

    console.log(
      "BUTTONS:",
      buttons
    );

    const sent =
      await sendButtons(
        m.chat_id,
        text,
        buttons
      );

    console.log(
      "BUTTON RESULT:",
      sent
    );
  }

  return;
}

  // ======================
  // MULTI
  // ======================

  const text =
    buildStockRequestMessage({
      outletName,
      rows
    });

  for (let m of managers) {

    const approveTitle =
      `APPROVE_ALL_${outletName.toUpperCase()}`;

    const rejectTitle =
      `REJECT_ALL_${outletName.toUpperCase()}`;

    const sent =
      await sendButtons(
        m.chat_id,
        text,
        [
          {
            id:
              `approve_all_${outletId}`,

            title:
              approveTitle
          },
          {
            id:
              `reject_all_${outletId}`,

            title:
              rejectTitle
          }
        ]
      );

    if (!sent.ok) {

      console.log(
        "SKIP MANAGER:",
        m.chat_id
      );
    }
  }
}

module.exports = {
  notifySmartStock
};