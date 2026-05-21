// ======================
// NOTIFY SMART
// ======================
async function notifySmartStock(outletId,latestRequest) {

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
    await getManagersByOutlet(outletId);

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
`📥 STOCK ${r.type.toUpperCase()} - ${outletName}

ID ${r.id} ${r.item} x${r.qty}
BY: ${r.users?.nickname || "-"}

`;

    for (let m of managers) {

      global.buttonMap =
        global.buttonMap || {};

      global.buttonMap[m.chat_id] = {
        ...(global.buttonMap[m.chat_id] || {}),

        APPROVE:
          `APPROVE ${r.id}`,

        REJECT:
          `REJECT ${r.id}`
      };

      await sendButtons(
        m.chat_id,
        text,
        [
          {
            id: `APPROVE_${r.id}`,
            title: "APPROVE"
          },
          {
            id: `REJECT_${r.id}`,
            title: "REJECT"
          }
        ]
      );
    }

    return;
  }

  // ======================
  // MULTI STACK
  // ======================

  rows.sort((a, b) => {

    if (a.type !== b.type) {
      return a.type === "in"
        ? -1
        : 1;
    }

    if (
      a.requested_by !==
      b.requested_by
    ) {
      return a.requested_by
        .localeCompare(
          b.requested_by
        );
    }

    return (
      new Date(a.created_at) -
      new Date(b.created_at)
    );
  });

  let text =
`📦 STOCK REQUEST - ${outletName.toUpperCase()}

`;

  let currentType = null;
  let currentUser = null;

  for (let r of rows) {

    if (currentType !== r.type) {

      text +=
        r.type === "in"
          ? "📥 IN\n"
          : "\n📤 OUT\n";

      currentType = r.type;
      currentUser = null;
    }

    if (
      currentUser !== r.requested_by
    ) {

      const { data: reqUser } =
        await supabase
          .from("users")
          .select(`
            nickname,
            chat_id
          `)
          .eq(
            "chat_id",
            r.requested_by
          )
          .maybeSingle();

      const displayName =
        reqUser?.nickname ||
        r.requested_by;

      const displayPhone =
        reqUser?.chat_id ||
        r.requested_by;

      text +=
`BY: ${toProperCase(displayName)} (${displayPhone})
`;

      currentUser =
        r.requested_by;
    }

    text +=
`ID ${r.id} ${r.item} x${r.qty}
`;
  }

  for (let m of managers) {

    const approveTitle =
      `APPROVE ${outletName.toUpperCase()}`;

    const rejectTitle =
      `REJECT ${outletName.toUpperCase()}`;

    global.buttonMap =
      global.buttonMap || {};

    global.buttonMap[m.chat_id] = {
      ...(global.buttonMap[m.chat_id] || {}),

      [approveTitle.toUpperCase()]:
        `APPROVE_ALL_${outletId}`,

      [rejectTitle.toUpperCase()]:
        `REJECT_ALL_${outletId}`
    };

    const sent =
      await sendButtons(
        m.chat_id,
        text,
        [
          {
            id:
              `APPROVE_ALL_${outletId}`,

            title:
              approveTitle
          },
          {
            id:
              `REJECT_ALL_${outletId}`,

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