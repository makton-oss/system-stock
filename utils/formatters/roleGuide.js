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

🗑️ Rekod wastage:
WASTAGE ayam 2

────────────────────

📦 Semak stok:
STOCK

────────────────────

📋 Semak request:
LIST

────────────────────

⚠️ PENTING:
- Rekod IN dan OUT boleh dibuat pada bila-bila masa
- JANGAN tunggu waktu closing baru nak rekod
- Rekod terus bila barang masuk atau digunakan
- Rekod tepat = stok tepat

❓ Bantuan:
HELP
`,

supervisor: `
📋 SUPERVISOR GUIDE

Hai 👋
Anda semak dan luluskan request outlet anda.

────────────────────

📥 Request masuk:
- Notifikasi akan masuk bila staff hantar request
- Tekan butang APPROVE atau REJECT pada notifikasi

────────────────────

📋 Semak request pending:
PENDING

────────────────────

📦 Semak stok:
STOCK

────────────────────

📦 Semak item config:
ITEM

────────────────────

⚠️ PENTING:
- Semua request MESTI di-approve atau reject
  sebelum jam 12 malam
- Jangan biarkan request pending hingga esok

❓ Bantuan:
HELP
`,

  manager: `
📊 MANAGER GUIDE

Hai 👋
Anda urus approval & pantau stok outlet.

────────────────────

📥 Request masuk:
- Notifikasi akan masuk bila staff hantar request
- Tekan butang APPROVE atau REJECT pada notifikasi

────────────────────

📋 Semak request:
PENDING

────────────────────

📦 Semak stok:
STOCK

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

⚠️ PENTING:
- Semua request MESTI di-approve atau reject
  sebelum jam 12 malam
- Jangan biarkan request pending hingga esok

❓ Bantuan:
HELP
`,

  owner: `
👔 OWNER GUIDE

Hai 👋
Pantau operasi dan laporan semua outlet.

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

💡 TIPS:
- REPORT untuk tengok prestasi outlet
- STOCK untuk semak stok semua outlet

❓ Bantuan:
HELP
`,

  admin: `
🛠 ADMIN GUIDE

Hai 👋
Akses penuh semua outlet & sistem.

────────────────────

👤 Urus user:
SETROLE 60123456789 ali manager muiz

✅ Format:
[phone] [nickname] [role] [outlet]

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

📦 Semak stok:
STOCK

────────────────────

📦 Semak item config:
ITEM

────────────────────

📊 REPORT

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
- Format SETROLE: phone nickname role outlet

❓ Bantuan:
HELP
`
};

function getRoleGuide(role) {
  return ROLE_GUIDE[role] || "";
}

module.exports = { ROLE_GUIDE, getRoleGuide };