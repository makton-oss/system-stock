const { sendText } = require("../../notification/notificationRouter");
const { toProperCase } = require("../../../utils/helpers");

module.exports = async ({ by, rows, channel = "botcommerce" }) => {

  if (!rows?.length) return;

  // ======================
  // GROUP BY STAFF (requested_by) — 1 mesej per staff
  // ======================
  const grouped = {};

  rows.forEach(r => {
    const staffId = r.requested_by;
    if (!staffId || staffId === by) return; // skip kalau yg reject = yg request sendiri
    if (!grouped[staffId]) grouped[staffId] = [];
    grouped[staffId].push(r);
  });

  for (const [staffId, items] of Object.entries(grouped)) {

    let text = "❌ REQUEST DITOLAK\n\n";

    items.forEach(r => {
      text += `${toProperCase(r.item)} x${r.qty}\n`;
    });

    text += "\nSila semak dan hantar semula jika perlu.";

    try {
      await sendText(staffId, text, channel);
    } catch (err) {
      console.log("NOTIFY STAFF REJECT ERROR:", staffId, err);
    }
  }
};