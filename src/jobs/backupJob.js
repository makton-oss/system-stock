const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
const supabase = require("../../services/db");

const BACKUP_ROOT = path.join(__dirname, "../../backups");
const RETENTION_DAYS = 60;
const PAGE_SIZE = 1000;

// ======================
// TABLES TO BACKUP
// ======================
const TABLES = [
  "users",
  "item_stock",
  "movements",
  "requests",
  "snapshots"
];

// ======================
// EXPORT TABLE
// ======================
async function exportTable(tableName, tenantId) {

  let allData = [];
  let from = 0;

  while (true) {

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("tenant_id", tenantId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.log(`❌ BACKUP ERROR [${tableName}]`, error);
      return null;
    }

    if (!data?.length) break;

    allData.push(...data);
    from += PAGE_SIZE;
  }

  if (!allData.length) {
    console.log(`⚠️ SKIP [${tableName}] — tiada data`);
    return [];
  }

  return allData;
}

// ======================
// STORAGE UPLOAD
// ======================
async function uploadToStorage(filePath, storagePath) {

  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from("backups")
    .upload(storagePath, fileBuffer, {
      contentType: "text/csv",
      upsert: true
    });

  if (error) {
    console.log(`❌ STORAGE ERROR: ${storagePath}`, error);
    return false;
  }

  console.log(`☁️ UPLOADED: ${storagePath}`);
  return true;
}

// ======================
// CLEAN OLD LOCAL BACKUPS
// ======================
function cleanOldBackups(tenantSlug) {

  const tenantDir = path.join(BACKUP_ROOT, tenantSlug);

  if (!fs.existsSync(tenantDir)) return;

  const folders = fs.readdirSync(tenantDir);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  for (const folder of folders) {

    const folderDate = new Date(folder);

    if (isNaN(folderDate)) continue;

    if (folderDate < cutoff) {

      fs.rmSync(
        path.join(tenantDir, folder),
        {
          recursive: true,
          force: true
        }
      );

      console.log(
        `🗑️ DELETED OLD BACKUP: ${tenantSlug}/${folder}`
      );
    }
  }
}

// ======================
// BACKUP TENANT
// ======================
async function backupTenant(tenant) {

  const today = new Date()
    .toISOString()
    .split("T")[0];

  const dir = path.join(
    BACKUP_ROOT,
    tenant.slug,
    today
  );

  fs.mkdirSync(dir, {
    recursive: true
  });

  const backupInfo = {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    tenant_slug: tenant.slug,
    backup_date: today,
    tables: []
  };

  for (const table of TABLES) {

    const data = await exportTable(
      table,
      tenant.id
    );

    if (data === null) continue;

    if (!data.length) {

      backupInfo.tables.push({
        table,
        rows: 0
      });

      continue;
    }

    try {

      const parser = new Parser();
      const csv = parser.parse(data);

      const filePath = path.join(
        dir,
        `${table}.csv`
      );

      fs.writeFileSync(filePath, csv);

      console.log(
        `✅ BACKUP [${table}] — ${data.length} rows`
      );

      await uploadToStorage(
        filePath,
        `${tenant.slug}/${today}/${table}.csv`
      );

      backupInfo.tables.push({
        table,
        rows: data.length
      });

    } catch (err) {

      console.log(
        `❌ CSV ERROR [${table}]`,
        err
      );
    }
  }

  // upload metadata
  await supabase.storage
    .from("backups")
    .upload(
      `${tenant.slug}/${today}/backup_info.json`,
      fs.readFileSync(infoPath),
      {
        contentType: "application/json",
        upsert: true
      }
    );

  // update last backup
  await supabase
    .from("tenants")
    .update({
      last_backup_at: new Date().toISOString()
    })
    .eq("id", tenant.id);

  cleanOldBackups(tenant.slug);

  console.log(
    `📦 BACKUP DONE: ${tenant.slug}`
  );
}

// ======================
// MAIN
// ======================
async function runBackup() {

  console.log("🔄 BACKUP STARTED");

  const { data: tenants, error } =
    await supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("has_backup", true)
      .eq("is_active", true);

  if (error) {

    console.log(
      "❌ FETCH TENANTS ERROR:",
      error
    );

    return;
  }

  if (!tenants?.length) {

    console.log(
      "⚠️ TIADA TENANT UNTUK BACKUP"
    );

    return;
  }

  for (const tenant of tenants) {

    try {

      await backupTenant(tenant);

    } catch (err) {

      console.log(
        `❌ BACKUP FAILED [${tenant.slug}]`,
        err
      );
    }
  }

  console.log("✅ ALL BACKUP DONE");
}

module.exports = {
  runBackup
};