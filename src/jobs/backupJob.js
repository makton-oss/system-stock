const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
const supabase = require("../../services/db");

const BACKUP_ROOT = path.join(__dirname, "../../backups");
const RETENTION_DAYS = 60;

// ======================
// TABLES TO BACKUP
// ======================
const TABLES = [
  "item_stock",   // ✅
  "movements",    // ✅
  "requests",     // ✅
  "snapshots",    // ✅
  "users"         // ✅
];

// ======================
// EXPORT TABLE TO CSV
// ======================
async function exportTable(tableName, tenantId) {

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) {
    console.log(`❌ BACKUP ERROR [${tableName}]:`, error);
    return false;
  }

  if (!data?.length) {
    console.log(`⚠️ SKIP [${tableName}] — tiada data`);
    return true;
  }

  return data;
}

// ======================
// DELETE OLD BACKUPS
// ======================
function cleanOldBackups(tenantSlug) {

  const tenantDir = path.join(BACKUP_ROOT, tenantSlug);

  if (!fs.existsSync(tenantDir)) return;

  const folders = fs.readdirSync(tenantDir);
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  folders.forEach(folder => {

    const folderDate = new Date(folder);

    if (isNaN(folderDate)) return;

    if (folderDate < cutoff) {
      fs.rmSync(path.join(tenantDir, folder), { recursive: true });
      console.log(`🗑️ DELETED OLD BACKUP: ${tenantSlug}/${folder}`);
    }
  });
}

// ======================
// BACKUP SINGLE TENANT
// ======================
async function backupTenant(tenant) {

  const today    = new Date().toISOString().split("T")[0];
  const dir      = path.join(BACKUP_ROOT, tenant.slug, today);

  // create folder
  fs.mkdirSync(dir, { recursive: true });

  for (const table of TABLES) {

    // users — filter by tenant_id (nullable)
    const data = await exportTable(table, tenant.id);

    if (!data) continue; // error
    if (data === true) continue; // empty, skip

    try {
      const parser = new Parser();
      const csv    = parser.parse(data);
      const file   = path.join(dir, `${table}.csv`);

      fs.writeFileSync(file, csv);
      console.log(`✅ BACKUP [${table}] — ${data.length} rows`);

    } catch (err) {
      console.log(`❌ CSV ERROR [${table}]:`, err);
    }
  }

  // clean old backups
  cleanOldBackups(tenant.slug);

  console.log(`📦 BACKUP DONE: ${tenant.slug} (${today})`);
}

// ======================
// MAIN
// ======================
async function runBackup() {

  console.log("🔄 BACKUP STARTED");

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("has_backup", true)
    .eq("is_active", true);

  if (error) {
    console.log("❌ FETCH TENANTS ERROR:", error);
    return;
  }

  if (!tenants?.length) {
    console.log("⚠️ TIADA TENANT WITH BACKUP");
    return;
  }

  for (const tenant of tenants) {
    await backupTenant(tenant);
  }

  console.log("✅ ALL BACKUP DONE");
}

module.exports = { runBackup };