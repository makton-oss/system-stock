const { normalizeItem } = require("./helpers");

function parseUpItem(parts) {

  const upper =
    parts.map(p => p.toUpperCase());

  const costIdx =
    upper.indexOf("COST");

  const minIdx =
    upper.indexOf("MIN");

  if (costIdx === -1 && minIdx === -1) {
    return { error: "NO_UPDATES" };
  }

  // outlet = last word
  const outletName =
    parts.at(-1);

  if (!isNaN(outletName)) {
    return { error: "NO_OUTLET" };
  }

  // item = antara UPITEM dan keyword pertama
  const firstKeyword = Math.min(
    costIdx !== -1 ? costIdx : Infinity,
    minIdx  !== -1 ? minIdx  : Infinity
  );

  const item =
    normalizeItem(
      parts.slice(1, firstKeyword).join(" ")
    );

  if (!item) {
    return { error: "NO_ITEM" };
  }

  // build updates
  const updates = {};

  if (costIdx !== -1) {

    const cost =
      parseFloat(parts[costIdx + 1]);

    if (isNaN(cost) || cost < 0) {
      return { error: "INVALID_COST" };
    }

    updates.cost_price = cost;
  }

  if (minIdx !== -1) {

    const min =
      parseInt(parts[minIdx + 1]);

    if (isNaN(min) || min < 0) {
      return { error: "INVALID_MIN" };
    }

    updates.min_qty = min;
  }

  return { item, outletName, updates };
}

module.exports = { parseUpItem };