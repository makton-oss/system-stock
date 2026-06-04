const ROLE_GUIDE = {

  staff: `
📦 STAFF GUIDE

Hai 👋
Gunakan sistem untuk rekod keluar masuk barang.

────────────────────

📥 Barang masuk:
IN ayam 10
IN tepung 5

────────────────────

📤 Barang guna:
OUT ayam 2
OUT tepung 1

────────────────────

📦 Semak stok:
STOCK

────────────────────

📋 Semak request pending:
LIST

────────────────────

💡 TIPS:
- IN = tambah stok
- OUT = tolak stok
- Semua request perlu approve manager

❓ Bantuan:
HELP
`,

  manager: `
📊 MANAGER GUIDE

Hai 👋
Anda urus approval & pantau stok outlet.

────────────────────

📋 Semak request:
LIST

────────────────────

✅ Luluskan request:
APPROVE 12
APPROVE ALL

────────────────────

❌ Tolak request:
REJECT 12
REJECT ALL

────────────────────

📦 Semak stok:
STOCK

────────────────────

📦 Semak item config:
ITEM

────────────────────

📊 REPORT

Main report:
REPORT
REPORT may-26

Detail:
REPORT INVENTORY
REPORT DETAIL
REPORT FLOW
REPORT DEAD

────────────────────

👥 Semak staff:
STAFF

────────────────────

💡 TIPS:
- Check LIST sebelum approve
- Pastikan request betul sebelum approve

❓ Bantuan:
HELP
`,

  admin: `
🛠 ADMIN GUIDE

Hai 👋
Akses penuh semua outlet & sistem.

────────────────────

👤 Urus user:
SETROLE 60123456789 manager ali muiz

✅ Format:
[phone] [role] [nickname] [outlet]

────────────────────

🗑 Buang user:
REMOVEROLE 60123456789

────────────────────

👥 Semak staff:
STAFF

────────────────────

📜 Log sistem:
LOG

────────────────────

📦 STOCK (semua outlet):
STOCK

────────────────────

📦 ITEM CONFIG:
ITEM

────────────────────

📊 REPORT (semua outlet)

Main:
REPORT
REPORT may-26

Detail:
REPORT INVENTORY
REPORT DETAIL
REPORT FLOW
REPORT DEAD

────────────────────

📋 Semak request:
LIST

────────────────────

➕ Tambah item:
ADDITEM minyak bijan kering 2 9 botol bta

✅ Format:
[nama item] [category] [min_qty] [cost] [uom] [outlet]

────────────────────

➖ Buang item:
REMOVEITEM minyak bijan

────────────────────

💡 TIPS:
- Nama item mesti konsisten (elak duplicate)
- Pastikan cost, uom & min qty betul
- Item akan digunakan oleh outlet tersebut

❓ Bantuan:
HELP
`
};

function getRoleGuide(role) {
  return ROLE_GUIDE[role] || "";
}

module.exports = { ROLE_GUIDE, getRoleGuide };