const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const ROOT = path.join(__dirname, '..', '..', 'uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// صور فقط (JPEG/PNG/WebP). SVG ممنوع لأنه قد يحوي سكربتات تُنفَّذ عند فتحه من نفس النطاق.
function imageUploader(subdir, maxBytes) {
  const dir = path.join(ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      // الامتداد من نوع الملف وليس من اسمه الأصلي
      filename: (req, file, cb) => cb(null, uuidv4() + EXT[file.mimetype]),
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => cb(null, !!EXT[file.mimetype]),
  });
}

module.exports = imageUploader('menu', 3 * 1024 * 1024);
module.exports.logoUpload = imageUploader('branding', 2 * 1024 * 1024);
module.exports.UPLOADS_ROOT = ROOT;
