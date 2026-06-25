const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requireAdminToken } = require("../core/requireAdminToken");
const { runBulkImportItems } = require("../services/imports/runBulkImportItems");
const { runBulkImportUsers } = require("../services/imports/runBulkImportUsers");

// ======================
// FILE UPLOAD CONFIG — untuk admin bulk import (.xlsx)
// Fail disimpan sementara dalam tmp_uploads/, automatik dipadam
// lepas proses import settle (success ATAU fail) — tengok finally{} block
// ======================
const uploadDir = path.join(__dirname, "../tmp_uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB per fail
  fileFilter: (req, file, cb) => {
    cb(null, file.originalname.toLowerCase().endsWith(".xlsx"));
  }
});

// requireAdminToken DULU sebelum multer — kalau token salah, fail tak
// sampai ditulis ke disk langsung (sebelum ni kena tulis dulu baru padam)
router.use(requireAdminToken);

router.post("/items", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "FILE_REQUIRED (.xlsx sahaja)" });
  }

  const slug   = req.body.slug;
  const dryRun = req.body.dryRun === "true";

  if (!slug) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "SLUG_REQUIRED" });
  }

  try {
    const result = await runBulkImportItems({ slug, filePath: req.file.path, dryRun });
    res.json(result);
  } catch (err) {
    console.error("IMPORT ITEMS ERROR:", err);
    res.status(500).json({ error: "IMPORT_FAILED" });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

router.post("/users", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "FILE_REQUIRED (.xlsx sahaja)" });
  }

  const slug   = req.body.slug;
  const dryRun = req.body.dryRun === "true";

  if (!slug) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "SLUG_REQUIRED" });
  }

  try {
    const result = await runBulkImportUsers({ slug, filePath: req.file.path, dryRun });
    res.json(result);
  } catch (err) {
    console.error("IMPORT USERS ERROR:", err);
    res.status(500).json({ error: "IMPORT_FAILED" });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

module.exports = router;