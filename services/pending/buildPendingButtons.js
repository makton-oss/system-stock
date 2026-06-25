// outletName = display name (for title shown to user)
// outletId   = numeric id (for reliable parsing)
function buildPendingButtons(outletName, outletId) {
  // BotCommerce matches on title, not id
  // Title format must match what parseRequestAction expects
  // APPROVE_ALL_<id> and REJECT_ALL_<id> are parsed directly without DB lookup
  return [
    {
      id:    `APPROVE_ALL_${outletId.toUpperCase()}`,
      title: `APPROVE ${outletName.toUpperCase()}`
    },
    {
      id:    `REJECT_ALL_${outletId.toUpperCase()}`,
      title: `REJECT ${outletName.toUpperCase()}`
    }
  ];
}

module.exports = { buildPendingButtons };