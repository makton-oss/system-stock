const supabase = require("../db");

// pattern sama macam ensureBackupBucket() dalam backupJob.js
async function ensureExportsBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === "exports");

  if (!exists) {
    const { error } = await supabase.storage.createBucket("exports", {
      public: false
    });
    if (error) {
      console.log("❌ FAILED TO CREATE EXPORTS BUCKET:", error.message);
      return false;
    }
    console.log("✅ BUCKET 'exports' CREATED");
  }
  return true;
}

module.exports = { ensureExportsBucket };