/**
 * SHA256 内容指纹模块
 *
 * 为 SkillHub 资源文件计算内容哈希、提取 YAML frontmatter 元数据、
 * 生成指纹数据，用于资源变更检测和去重。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 计算单个文件的 SHA256 内容哈希
 *
 * 读取文件全部内容后计算哈希。文件不存在或读取失败时返回 null。
 *
 * @param {string} filePath - 文件绝对路径
 * @returns {string|null} SHA256 哈希值（64 位十六进制字符串），失败时返回 null
 */
function computeFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (err) {
    return null;
  }
}

/**
 * 计算文件集合的 SHA256 组合哈希
 *
 * 将所有文件的哈希值按文件路径排序后拼接，再对拼接结果计算一次 SHA256，
 * 确保文件顺序不影响最终哈希值。
 *
 * @param {string[]} filePaths - 文件绝对路径数组
 * @returns {string|null} 组合哈希值，文件列表为空或所有文件均不可读时返回 null
 */
function computeCollectionHash(filePaths) {
  if (!filePaths || filePaths.length === 0) {
    return null;
  }

  // 按路径排序，保证顺序无关性
  const sortedPaths = [...filePaths].sort();

  const hashes = [];
  for (const fp of sortedPaths) {
    const h = computeFileHash(fp);
    if (h === null) {
      // 单个文件不可读时跳过，但仍继续处理其余文件
      continue;
    }
    hashes.push(h);
  }

  if (hashes.length === 0) {
    return null;
  }

  const combined = hashes.join('');
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * 从文件内容中提取 YAML frontmatter 元数据
 *
 * 支持 `---` 分隔的标准 YAML frontmatter 格式：
 *   ---
 *   key: value
 *   another: value
 *   ---
 *   正文内容...
 *
 * @param {string} filePath - 文件绝对路径
 * @returns {object} 解析结果，包含 metadata（frontmatter 字段对象）和 body（正文内容字符串）
 *                    文件不存在、无 frontmatter 或解析失败时，metadata 为空对象 {}
 */
function extractFrontmatter(filePath) {
  const result = { metadata: {}, body: '' };

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const trimmed = content.trimStart();

    // frontmatter 必须以 --- 开头
    if (!trimmed.startsWith('---')) {
      result.body = content;
      return result;
    }

    // 找到第二个 ---（frontmatter 结束标记）
    const endMarkerIndex = trimmed.indexOf('---', 3);
    if (endMarkerIndex === -1) {
      // 只有开始标记，没有结束标记，视为无 frontmatter
      result.body = content;
      return result;
    }

    const yamlBlock = trimmed.slice(3, endMarkerIndex).trim();
    const bodyContent = trimmed.slice(endMarkerIndex + 3).trimStart();

    // 简易 YAML 解析：仅支持 key: value 单行格式，不支持嵌套结构
    // 这样可以避免引入额外的 YAML 解析依赖，覆盖大部分 frontmatter 场景
    const metadata = {};
    for (const line of yamlBlock.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const rawValue = line.slice(colonIndex + 1).trim();

      // 类型推断：字符串、数字、布尔
      let value = rawValue;
      if (rawValue === 'true') {
        value = true;
      } else if (rawValue === 'false') {
        value = false;
      } else if (rawValue !== '' && !isNaN(Number(rawValue))) {
        value = Number(rawValue);
      }

      metadata[key] = value;
    }

    result.metadata = metadata;
    result.body = bodyContent;
  } catch (err) {
    // 文件读取失败，返回空结果
  }

  return result;
}

/**
 * 为扫描出的资源项生成完整指纹数据
 *
 * item 结构与 scanner.js 输出一致：
 *   { platform, type, name, displayName, files }
 *
 * 生成的指纹数据包含：
 *   - 唯一标识（platform + type + name 组合）
 *   - 文件哈希映射（每个文件的 SHA256）
 *   - 集合哈希（所有文件内容的组合哈希）
 *   - frontmatter 元数据（从每个 .md 文件提取）
 *   - 文件路径与文件名映射
 *   - 生成时间戳
 *
 * @param {object} item - 扫描出的资源项
 * @param {string} item.platform - 平台标识
 * @param {string} item.type - 资源类型
 * @param {string} item.name - 资源名称
 * @param {string} item.displayName - 显示名称
 * @param {string[]} item.files - 文件路径数组
 * @returns {object} 指纹数据对象
 */
function generateFingerprint(item) {
  const { platform, type, name, displayName, files } = item;

  // 文件哈希映射：filePath → hash
  const fileHashes = {};
  for (const fp of files) {
    const hash = computeFileHash(fp);
    if (hash !== null) {
      fileHashes[fp] = hash;
    }
  }

  // 集合哈希：所有文件内容的组合指纹
  const collectionHash = computeCollectionHash(files);

  // frontmatter 提取：从 .md / .mdc 文件提取元数据
  const frontmatter = {};
  for (const fp of files) {
    const ext = path.extname(fp);
    if (ext === '.md' || ext === '.mdc') {
      const { metadata } = extractFrontmatter(fp);
      if (Object.keys(metadata).length > 0) {
        frontmatter[path.basename(fp)] = metadata;
      }
    }
  }

  // 文件名映射：filePath → basename
  const fileNames = {};
  for (const fp of files) {
    fileNames[fp] = path.basename(fp);
  }

  return {
    id: `${platform}:${type}:${name}`,
    platform,
    type,
    name,
    displayName,
    fileHashes,
    collectionHash,
    frontmatter,
    fileNames,
    fileCount: files.length,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  computeFileHash,
  computeCollectionHash,
  extractFrontmatter,
  generateFingerprint,
};