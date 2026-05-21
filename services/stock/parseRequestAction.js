function parseRequestAction(raw = "") {

  const upper =
    raw.toUpperCase().trim();

  // ======================
  // APPROVE ALL
  // ======================

  if (
    upper.startsWith("APPROVE_ALL_")
  ) {

    return {
      action: "approve",
      isAll: true,
      outletKey:
        upper.replace(
          "APPROVE_ALL_",
          ""
        )
    };
  }

  // ======================
  // REJECT ALL
  // ======================

  if (
    upper.startsWith("REJECT_ALL_")
  ) {

    return {
      action: "reject",
      isAll: true,
      outletKey:
        upper.replace(
          "REJECT_ALL_",
          ""
        )
    };
  }

  // ======================
  // APPROVE SINGLE
  // ======================

  if (
    upper.startsWith("APPROVE ")
  ) {

    return {
      action: "approve",
      isAll: false,
      requestId: Number(
        upper.split(" ")[1]
      )
    };
  }

  // ======================
  // REJECT SINGLE
  // ======================

  if (
    upper.startsWith("REJECT ")
  ) {

    return {
      action: "reject",
      isAll: false,
      requestId: Number(
        upper.split(" ")[1]
      )
    };
  }

  return null;
}

module.exports = {
  parseRequestAction
};