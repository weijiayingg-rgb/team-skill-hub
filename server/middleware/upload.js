const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 确保上传目录存在
const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/plain', 'text/markdown', 'text/x-markdown',
    'application/json', 'application/x-yaml', 'text/yaml',
    'text/x-shellscript', 'application/x-sh',
    'image/png', 'image/jpeg', 'image/svg+xml',
    'application/octet-stream',
    'application/zip', 'application/x-zip-compressed',
  ];
  // 也允许 .md, .yaml, .json, .sh, .zip 等常见扩展名
  const allowedExts = ['.md', '.yaml', '.yml', '.json', '.sh', '.txt', '.js', '.py', '.png', '.jpg', '.svg', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype} (${ext})`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB（expert ZIP 包可能较大）
    files: 20,
  },
});

module.exports = upload;
