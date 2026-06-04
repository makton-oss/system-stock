const { toProperCase } = require("../helpers");

// ======================
// STAFF — single outlet
// ======================
function formatStaffList(rows) {
  if (!rows?.length) return "👥 STAFF KOSONG";

  const outlet   = rows[0]?.outlets?.name || "-";
  const managers = rows.filter(r => r.role === "manager");
  const staff    = rows.filter(r => r.role === "staff");

  let text = `👥 STAFF LIST\n${toProperCase(outlet)}\n\n`;

  if (managers.length) {
    text += "Manager\n";
    managers.forEach((u, i) => {
      text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
    });
    text += "\n";
  }

  if (staff.length) {
    text += "Staff\n";
    staff.forEach((u, i) => {
      text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
    });
  }

  return text;
}

// ======================
// STAFF — multi outlet
// ======================
function formatStaffListAdmin(rows) {
  if (!rows?.length) return "👥 STAFF KOSONG";

  const map = new Map();
  rows.forEach(r => {
    const outlet = r.outlets?.name || "-";
    if (!map.has(outlet)) map.set(outlet, { manager: [], staff: [] });
    if (r.role === "manager")    map.get(outlet).manager.push(r);
    else if (r.role === "staff") map.get(outlet).staff.push(r);
  });

  let text = "👥 STAFF LIST\n\n";

  map.forEach((group, outlet) => {
    text += `${toProperCase(outlet)}\n\n`;

    if (group.manager.length) {
      text += "Manager\n";
      group.manager.forEach((u, i) => {
        text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
      });
      text += "\n";
    }

    if (group.staff.length) {
      text += "Staff\n";
      group.staff.forEach((u, i) => {
        text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
      });
    }

    text += "\n";
  });

  return text;
}

module.exports = {
  formatStaffList,
  formatStaffListAdmin
};