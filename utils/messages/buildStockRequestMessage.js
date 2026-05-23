const { toProperCase } = require("../formatter");

function buildStockRequestMessage({
  rows,
  outletName
}) {

  // ======================
  // SINGLE
  // ======================

  if (rows.length === 1) {

    const r = rows[0];

    return (
`📥 STOCK ${r.type.toUpperCase()} - ${outletName}

ID ${r.id} ${r.item} x${r.qty}
BY: ${r.users?.nickname || "-"}
`
    );
  }

  // ======================
  // MULTI
  // ======================

  let text =
`📦 STOCK REQUEST - ${toProperCase(outletName)}

`;

  const grouped = {
    in: {},
    out: {},
    wastage: {}
  };

  // ======================
  // GROUP
  // ======================

  for (const r of rows) {

    const type =
      r.type?.toLowerCase();

    if (
      type !== "in" &&
      type !== "out" &&
      type !== "wastage"
    ) continue;

    const userKey =
      r.requested_by;

    if (!grouped[type][userKey]) {

      grouped[type][userKey] = {
        user: r.users,
        rows: []
      };
    }

    grouped[type][userKey]
      .rows.push(r);
  }

  // ======================
  // IN
  // ======================

  if (
    Object.keys(grouped.in).length
  ) {

    text += "📥 IN\n";

    Object.values(grouped.in)
      .forEach(group => {

      const displayName =
        group.user?.nickname || "-";

      const displayPhone =
        group.user?.chat_id || "-";

      text +=
  `BY: ${toProperCase(displayName)} (${displayPhone})
  `;

      group.rows.forEach(r => {

        text +=
  `ID ${r.id} ${r.item} x${r.qty}
  `;
      });

      text += "\n";
    });
  }

  // ======================
  // OUT
  // ======================

  if (
    Object.keys(grouped.out).length
  ) {

    text += "📤 OUT\n";

    Object.values(grouped.out)
      .forEach(group => {

      const displayName =
        group.user?.nickname || "-";

      const displayPhone =
        group.user?.chat_id || "-";

      text +=
  `BY: ${toProperCase(displayName)} (${displayPhone})
  `;

      group.rows.forEach(r => {

        text +=
  `ID ${r.id} ${r.item} x${r.qty}
  `;
      });

      text += "\n";
    });
  }

  // ======================
  // WASTAGE
  // ======================

  if (
    Object.keys(grouped.wastage).length
  ) {

    text += "🗑️ WASTAGE\n";

    Object.values(grouped.wastage)
      .forEach(group => {

      const displayName =
        group.user?.nickname || "-";

      const displayPhone =
        group.user?.chat_id || "-";

      text +=
  `BY: ${toProperCase(displayName)} (${displayPhone})
  `;

      group.rows.forEach(r => {

        text +=
  `ID ${r.id} ${r.item} x${r.qty}
  `;
      });

      text += "\n";
    });
  }

  return text;
}

module.exports = {
  buildStockRequestMessage
};