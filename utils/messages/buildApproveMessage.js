function buildApproveMessage(summary) {

  let text =
    "✅ APPROVED\n\n";

  Object.entries(summary)
    .forEach(([item, qty]) => {

      text +=
        `${item} ${qty > 0 ? "+" : ""}${qty}\n`;
    });

  return text;
}

module.exports = {
  buildApproveMessage
};