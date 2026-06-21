const ROLE_GUIDE = {

staff: `
📦 *PANDUAN STAFF*

Hai! 👋 Selamat datang ke StokBot.
Guna sistem ni untuk rekod stok masuk & keluar outlet anda.

────────────────────

📥 *Stok masuk*
IN ayam 10

📤 *Stok keluar/guna*
OUT ayam 2

🗑️ *Wastage*
WASTAGE ayam 2

💡 Boleh rekod banyak item sekali gus — pisahkan dengan koma:
IN ayam 10, tepung 5, gula 2

────────────────────

📦 Semak stok semasa:
STOCK

📋 Semak status request anda:
STATUS

────────────────────

⚠️ *PENTING*
- Rekod bila-bila masa anda free hari ini — tak perlu tunggu closing time
- Rekod tepat = stok tepat = bisnes lancar

────────────────────

❓ Perlukan bantuan bila-bila masa? Taip HELP
`,

supervisor: `
📋 *PANDUAN SUPERVISOR*

Hai! 👋 Anda bertanggungjawab semak & luluskan request stok outlet anda.

────────────────────

📥 *Bila staff hantar request*
Notifikasi automatik akan masuk WhatsApp anda — tekan butang APPROVE atau REJECT terus dari situ.

📋 Semak semua request pending:
PENDING

📦 Semak stok semasa:
STOCK

📦 Semak konfigurasi item:
ITEM

────────────────────

⚠️ *PENTING*
- Approve atau reject SEMUA request sebelum 11:30 malam
- Request yang tertinggal akan jejaskan laporan harian — laporan ni penting untuk Owner pantau prestasi outlet

────────────────────

📲 *NOTA*
Pastikan anda hantar mesej/command kepada StokBot sekurang-kurangnya *sekali sehari* 
(contoh: taip STOCK), supaya anda terus terima notifikasi request baru.

────────────────────

❓ Perlukan bantuan? Taip HELP
`,

  manager: `
📊 *PANDUAN MANAGER*

Hai! 👋 Anda urus approval & pantau prestasi stok outlet anda.

────────────────────

📥 *Bila staff hantar request*
Notifikasi automatik akan masuk — tekan APPROVE atau REJECT terus dari WhatsApp.

📋 Semak request pending:
PENDING

📦 Semak stok semasa:
STOCK

────────────────────

📊 *LAPORAN*

Taip:
REPORT

Sistem akan papar butang — pilih jenis laporan dan bulan yang dikehendaki, semua guna butang, tak perlu hafal command.

💡 Jenis laporan:
Summary   — ringkasan keseluruhan bulan
Inventory — nilai stok pada tarikh tertentu
Flow      — aliran stok masuk/keluar
Dead      — item yang tak bergerak

────────────────────

👥 Semak senarai staff:
STAFF

────────────────────

⚠️ *PENTING*
- Approve atau reject SEMUA request sebelum 11:30 malam
- Request yang tertinggal akan jejaskan laporan harian — laporan ni penting untuk Owner pantau prestasi outlet

────────────────────

📲 *NOTA*
Pastikan anda hantar mesej/command kepada StokBot sekurang-kurangnya *sekali sehari* 
(contoh: taip STOCK), supaya anda terus terima notifikasi.

────────────────────

❓ Perlukan bantuan? Taip HELP
`,

  owner: `
👔 *PANDUAN OWNER*

Hai! 👋 Pantau operasi & prestasi semua outlet anda di sini.

────────────────────

📊 *LAPORAN*

Taip:
REPORT

Sistem akan papar butang — pilih jenis laporan dan bulan yang dikehendaki, semua guna butang, tak perlu hafal command.

💡 Jenis laporan:
Summary   — ringkasan keseluruhan bulan
Inventory — nilai stok pada tarikh tertentu
Flow      — aliran stok masuk/keluar
Dead      — item yang tak bergerak
Compare   — banding prestasi outlet/bulan

────────────────────

📦 Semak stok semua outlet:
STOCK

👥 Semak senarai staff:
STAFF

────────────────────

❓ Perlukan bantuan? Taip HELP
`,

  admin: `
🛠 *PANDUAN ADMIN*

Hai! 👋 Anda ada akses penuh ke semua outlet & sistem.

────────────────────

👤 *Urus user*
SETROLE 60123456789 manager ali muiz

Format: [phone] [role] [nickname] [outlet]

🗑 Buang akses user:
REMOVEROLE 60123456789

────────────────────

👥 Semak senarai staff:
STAFF

📜 Log sistem:
LOG

📦 Semak stok semua outlet:
STOCK

📦 Semak konfigurasi item:
ITEM

────────────────────

📊 *LAPORAN*

Taip:
REPORT

Sistem akan papar butang — pilih jenis laporan dan bulan yang dikehendaki, semua guna butang, tak perlu hafal command.

💡 Jenis laporan:
Summary   — ringkasan keseluruhan bulan
Inventory — nilai stok pada tarikh tertentu
Flow      — aliran stok masuk/keluar
Dead      — item yang tak bergerak

────────────────────

📋 Semak semua request pending:
PENDING

────────────────────

➕ *Tambah item baru*
ADDITEM minyak bijan kering 2 9 botol bta

Format: [nama item] [category] [min_qty] [cost] [uom] [outlet]

➖ *Buang item*
REMOVEITEM minyak bijan muiz

Format: [nama item] [outlet]

────────────────────

💡 *TIPS*
- Nama item mesti konsisten (elak duplicate)
- Pastikan cost, uom & min qty betul sebelum simpan
- Format SETROLE: phone role nickname outlet

────────────────────

❓ Perlukan bantuan? Taip HELP
`
};

function getRoleGuide(role) {
  return ROLE_GUIDE[role] || "";
}

module.exports = { ROLE_GUIDE, getRoleGuide };