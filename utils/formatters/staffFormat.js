const { toProperCase } = require("../helpers");

// ======================
// STAFF — single outlet
// ======================
function formatStaffList(rows) {
  if (!rows?.length) return "👥 STAFF KOSONG";

  const outlet     = rows[0]?.outlets?.name || "-";
  const managers   = rows.filter(r => r.role === "manager");
  const supervisors = rows.filter(r => r.role === "supervisor");
  const staff      = rows.filter(r => r.role === "staff");

  let text = `👥 STAFF LIST\n${toProperCase(outlet)}\n\n`;

  if (managers.length) {
    text += "Manager\n";
    managers.forEach((u, i) => {
      text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
    });
    text += "\n";
  }

  if (supervisors.length) {
    text += "Supervisor\n";
    supervisors.forEach((u, i) => {
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

function formatStaffListAdmin(rows) {
  if (!rows?.length) return "👥 STAFF KOSONG";

  const map = new Map();
  rows.forEach(r => {
    const outlet = r.outlets?.name || "-";
    if (!map.has(outlet)) map.set(outlet, { manager: [], supervisor: [], staff: [] });
    if (r.role === "manager")         map.get(outlet).manager.push(r);
    else if (r.role === "supervisor") map.get(outlet).supervisor.push(r);
    else if (r.role === "staff")      map.get(outlet).staff.push(r);
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

    if (group.supervisor.length) {
      text += "Supervisor\n";
      group.supervisor.forEach((u, i) => {
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

// ======================
// ORG VIEW — manager / admin / owner / superadmin@slug
// ======================
function formatStaffOrgView({ outletGroups = [], admins = [], owners = [] }) {

  if (!outletGroups.length && !admins.length && !owners.length) {
    return "👥 STAFF KOSONG";
  }

  let text = "👥 STAFF LIST\n\n";

  // ✅ Owner & Admin di ATAS dulu
  if (owners.length) {
    text += "👔 Owner\n";
    owners.forEach((u, i) => {
      text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
    });
    text += "\n";
  }

  if (admins.length) {
    text += "🛠 Admin\n";
    admins.forEach((u, i) => {
      text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
    });
    text += "\n";
  }

  outletGroups.forEach(group => {
    text += `🏪 ${(group.outletName || "-").toUpperCase()}\n`;

    if (group.managers.length) {
      text += "Manager\n";
      group.managers.forEach((u, i) => {
        text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
      });
    }

    if (group.supervisors.length) {
      text += "Supervisor\n";
      group.supervisors.forEach((u, i) => {
        text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
      });
    }

    if (group.staff.length) {
      text += "Staff\n";
      group.staff.forEach((u, i) => {
        text += `${i + 1}. ${toProperCase(u.nickname)} - ${u.chat_id}\n`;
      });
    }

    text += "\n";
  });

  return text.trim();
}

// ======================
// GLOBAL SUMMARY — superadmin (no slug)
// ======================
function formatStaffSummaryGlobal(rows) {

  if (!rows?.length) return "🌐 GLOBAL STAFF SUMMARY\n\nTiada tenant aktif";

  let text = "🌐 GLOBAL STAFF SUMMARY\n\n";

  rows.forEach(t => {
    text += `Tenant: ${t.tenantName}\n`;
    text += `🏪 outlet : ${t.outletCount}\n`;
    text += `👔 Owner: ${t.owner}\n`;
    text += `🛠 Admin: ${t.admin}\n`;
    text += `📊 Manager: ${t.manager}\n`;
    text += `👮 Supervisor: ${t.supervisor}\n`;
    text += `👤 Staff: ${t.staff}\n\n`;
  });

  return text.trim();
}

module.exports = {
  formatStaffList,
  formatStaffListAdmin,
  formatStaffOrgView,
  formatStaffSummaryGlobal
};