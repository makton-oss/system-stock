function buildApproveMessage(summary) {

  let text = "✅ APPROVED\n\n";

  Object.entries(summary).forEach(([item, data]) => {

    const sign = data.qty > 0 ? "+" : "";

    const balanceStr = data.balance !== null
      ? ` → Baki: ${data.balance}`
      : "";

    const warn = data.balance !== null && data.balance <= data.min
      ? data.balance === 0
        ? " 🚨"
        : " ⚠️"
      : "";

    text += `${item} ${sign}${data.qty}${balanceStr}${warn}\n`;
  });

  return text;
}

module.exports = { buildApproveMessage };