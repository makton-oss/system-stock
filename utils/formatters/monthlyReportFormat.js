const { toProperCase, formatAmount } = require("../helpers");

function formatMonthlyOwnerReport(result) {
  const { data, label, lowStock, health, insights } = result;

  const totalInventory = data.reduce((a, o) => a + (o.closingValue || 0), 0);
  const totalWastage = data.reduce((a, o) => a + o.wastage, 0);

  let text = `📊 MONTHLY REPORT\n${label}\n\n`;
  text += `Inventory Value\nRM ${formatAmount(totalInventory)}\n\n`;
  text += `Wastage\nRM ${formatAmount(totalWastage)}\n\n`;
  text += `Low Stock\n${lowStock.length} Items\n\n`;
  text += `Business Health\n${health}\n\n`;
  text += `━━━━━━━━━━\n\n`;
  insights.forEach(i => { text += `${i}\n`; });
  text += `\nReply: EXPORT SUMMARY untuk laporan penuh`;

  return text;
}

module.exports = { formatMonthlyOwnerReport };