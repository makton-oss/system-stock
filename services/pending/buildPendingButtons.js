function buildPendingButtons(
  outletName
) {

  return [
    {
      id:
        `approve ${outletName.toUpperCase()}`,

      title:
        `APPROVE ${outletName.toUpperCase()}`
    },
    {
      id:
        `reject ${outletName.toUpperCase()}`,

      title:
        `REJECT ${outletName.toUpperCase()}`
    }
  ];
}

module.exports = {
  buildPendingButtons
};