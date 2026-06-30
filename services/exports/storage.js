const supabase = require("../db");
const { DateTime } = require("luxon");

// ======================
// LAST MONTH WINDOW — hardcoded untuk export
// ======================
function getLastMonthWindow() {
  const lm = DateTime.now().setZone("Asia/Kuala_Lumpur").minus({ months: 1 });
  return {
    start:        lm.startOf("month").toUTC().toISO(),
    end:          lm.endOf("month").toUTC().toISO(),
    asOfDate:     lm.endOf("month").toISO(),
    snapshotDate: lm.endOf("month").toFormat("yyyy-MM-dd"),
    monthSlug:    lm.toFormat("yyyy-MM"),
    monthLabel:   lm.toFormat("LLLL yyyy").toUpperCase(),
    monthName:    lm.toFormat("LLLL"),
    monthInput:   lm.toFormat("LLL-yy").toLowerCase(),
    sheetMonth:   lm.toFormat("LLLL").toUpperCase()
  };
}

// ======================
// SHEET NAME — max 31 char, no special chars
// ======================
function sanitizeSheetName(name) {
  return String(name || "Sheet")
    .replace(/[\\\/\?\*\[\]\:]/g, "")
    .slice(0, 31);
}

// ======================
// ENSURE BUCKET
// ======================
async function ensureExportsBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === "exports");

  if (!exists) {
    const { error } = await supabase.storage.createBucket("exports", { public: false });
    if (error) {
      console.log("❌ FAILED TO CREATE EXPORTS BUCKET:", error.message);
      return false;
    }
    console.log("✅ BUCKET 'exports' CREATED");
  }
  return true;
}

// ======================
// UPLOAD + SIGN URL
// path: {tenantId}/{monthSlug}/{TYPE}_{chatId}.xlsx
// ======================
async function uploadAndSign(workbook, { tenantId, chatId, reportType, monthSlug }) {
  const buffer      = await workbook.xlsx.writeBuffer();
  const fileName    = `${reportType}_${monthSlug}_${chatId}.xlsx`;
  const storagePath = `${tenantId || "global"}/${monthSlug}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("exports")
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true
    });

  if (uploadError) {
    console.log("EXPORT UPLOAD ERROR:", uploadError);
    return { error: "UPLOAD_ERROR" };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("exports")
    .createSignedUrl(storagePath, 3600);

  if (signError) {
    console.log("EXPORT SIGN URL ERROR:", signError);
    return { error: "SIGN_ERROR" };
  }

  return { ok: true, url: signed.signedUrl, fileName };
}

module.exports = { getLastMonthWindow, sanitizeSheetName, ensureExportsBucket, uploadAndSign };