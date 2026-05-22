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

  let currentType = null;
  let currentUser = null;

  for (const r of rows) {

    if (currentType !== r.type) {

      text +=
        r.type === "in"
          ? "📥 IN\n"
          : "\n📤 OUT\n";

      currentType = r.type;

      currentUser = null;
    }

    if (
      currentUser !==
      r.requested_by
    ) {

      const displayName =
        r.users?.nickname ||
        r.requested_by;

      const displayPhone =
        r.users?.chat_id ||
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

  return text;
}

module.exports = {
  buildStockRequestMessage
};