require("dotenv").config();
const path = require("path");
const { runBulkImportItems } = require("../services/imports/runBulkImportItems");

(async () => {
  const slug     = process.argv[2];
  const filePath = process.argv[3];
  const dryRun   = process.argv.includes("--dry-run");

  if (!slug || !filePath) {
    console.log("❌ USAGE: node scripts/bulkImportItems.js <slug> <path-to-excel> [--dry-run]");
    process.exit(1);
  }

  const result = await runBulkImportItems({
    slug,
    filePath: path.resolve(filePath),
    dryRun
  });

  process.exit(result.ok ? 0 : 1);
})();