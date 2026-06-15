const resourceModel = require('../models/resources');
const gitStore = require('./git-store');
const manifestGenerator = require('./manifest-generator');
const tagModel = require('../models/tags');
const AdmZip = require('adm-zip');
const path = require('path');
const crypto = require('crypto');

/**
 * Semver 自动递增版本号
 * @param {string} current - 当前版本号，如 "1.2.3"
 * @param {string} type - 递增类型：patch / minor / major
 * @returns {string} 递增后的版本号
 */
function incrementVersion(current, type) {
  const parts = String(current).split('.');
  const major = parseInt(parts[0] || '0', 10);
  const minor = parseInt(parts[1] || '0', 10);
  const patch = parseInt(parts[2] || '0', 10);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`不支持的版本递增类型: ${type}，仅支持 patch / minor / major`);
  }
}

/**
 * 计算资源文件内容的 SHA256 哈希值
 * 将所有文件按 path 排序后拼接 content，生成整体哈希
 * @param {Array<{filename: string, path: string, content: string}>} files - 资源文件列表
 * @returns {string} SHA256 hex digest
 */
function computeContentHash(files) {
  const sorted = [...files].sort((a, b) => (a.path || a.filename).localeCompare(b.path || b.filename));
  const combined = sorted.map(f => f.content || '').join('\n---FILE_BOUNDARY---\n');
  return crypto.createHash('sha256').update(combined, 'utf-8').digest('hex');
}

// Simple version model inline
const versionModel = {
  create(data) {
    const { resource_id, version, changelog = '', file_url = '' } = data;
    const { getDb } = require('../models/db');
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO resource_versions (resource_id, version, changelog, git_tag, file_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(resource_id, version, changelog, `v${version}`, file_url);
    return { id: result.lastInsertRowid, ...data };
  },
  findByResourceId(resourceId) {
    const { getDb } = require('../models/db');
    const db = getDb();
    return db.prepare('SELECT * FROM resource_versions WHERE resource_id = ? ORDER BY created_at DESC').all(resourceId);
  }
};

/**
 * 从 expert ZIP buffer 中解析包结构
 * 标准结构：
 *   expert-name/
 *     metadata.yaml
 *     prompt.md（必须）
 *     skills/*.md
 *     tools/*.json
 *     README.md
 *
 * 返回 { files: [{ filename, path, content }], valid: boolean, error?: string }
 */
function parseExpertZip(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // 去除可能的顶层目录前缀（如 expert-name/prompt.md → prompt.md）
    let entryPath = entry.entryName.replace(/\\/g, '/');
    const parts = entryPath.split('/');
    // 如果所有文件都在同一个顶层目录下，去掉该前缀
    // 先收集所有路径再判断
    files.push({ rawPath: entryPath, content: entry.getData().toString('utf-8') });
  }

  if (files.length === 0) {
    return { files: [], valid: false, error: 'ZIP 包为空' };
  }

  // 检测公共前缀：如果所有文件都以同一目录开头，去掉它
  const allPaths = files.map(f => f.rawPath);
  const topLevelDirs = [...new Set(allPaths.map(p => p.split('/')[0]))];
  let prefix = '';
  if (topLevelDirs.length === 1 && allPaths.every(p => p.includes('/'))) {
    prefix = topLevelDirs[0] + '/';
  }

  const normalizedFiles = files.map(f => {
    const normalizedPath = prefix && f.rawPath.startsWith(prefix)
      ? f.rawPath.slice(prefix.length)
      : f.rawPath;
    return {
      filename: path.basename(normalizedPath),
      path: normalizedPath,
      content: f.content,
    };
  });

  // 验证必须包含 prompt.md
  const hasPrompt = normalizedFiles.some(f => f.path === 'prompt.md');
  if (!hasPrompt) {
    return { files: normalizedFiles, valid: false, error: '专家包缺少必需的 prompt.md 文件' };
  }

  return { files: normalizedFiles, valid: true };
}

/**
 * 统计 expert 包中的技能和工具数量
 */
function countExpertAssets(files) {
  const skills = files.filter(f => f.path.startsWith('skills/') && f.filename.endsWith('.md'));
  const tools = files.filter(f => f.path.startsWith('tools/'));
  return { skillCount: skills.length, toolCount: tools.length };
}

class ResourceManager {
  async create(metadata, files) {
    const { name, display_name, type, description, author_id, tags = [] } = metadata;
    const version = metadata.version || '1.0.0';

    // 检查名称唯一性
    const existing = resourceModel.findByName(name);
    if (existing) {
      const err = new Error(`资源名称已存在: ${name}`);
      err.statusCode = 409;
      err.code = 'CONFLICT';
      throw err;
    }

    const gitPath = `resources/${name}/v${version}`;

    // ===== Expert 类型 ZIP 包处理 =====
    let expertFiles = [];
    if (type === 'expert' && files.length === 1 && files[0].originalname?.toLowerCase().endsWith('.zip')) {
      const zipFile = files[0];
      const parsed = parseExpertZip(zipFile.buffer);
      if (!parsed.valid) {
        const err = new Error(parsed.error);
        err.statusCode = 400;
        err.code = 'INVALID_EXPERT_PACKAGE';
        throw err;
      }
      expertFiles = parsed.files;

      // 写入 Git 仓库（保留子目录结构）
      await gitStore.ensureResourceDir(name, version);
      for (const file of expertFiles) {
        await gitStore.writeResourceFile(name, version, file.path, file.content);
      }
    } else {
      // 非 expert 或普通文件上传 → 原有逻辑
      await gitStore.ensureResourceDir(name, version);
      for (const file of files) {
        await gitStore.writeResourceFile(name, version, file.originalname || file.filename, file.buffer ? file.buffer.toString('utf-8') : file.content);
      }
    }

    // 写入 metadata.yaml
    const metadataYaml = {
      name,
      display_name,
      type,
      description,
      author: metadata.author_name || '',
      tags,
      versions: [{
        version,
        date: new Date().toISOString().split('T')[0],
        changelog: metadata.changelog || '初始版本',
        entry_file: type === 'expert' ? 'prompt.md' : (files[0]?.originalname || files[0]?.filename || 'README.md'),
      }],
    };
    await gitStore.writeMetadata(name, metadataYaml);

    // Git commit
    await gitStore.commitAndPush(`feat: add resource ${name} v${version}`);

    // 构建 files 列表存入数据库
    let dbFiles;
    let hashFiles; // 用于计算 content_hash 的完整文件列表（包含 content）
    if (type === 'expert' && expertFiles.length > 0) {
      dbFiles = expertFiles.map(f => ({ filename: f.filename, path: f.path }));
      hashFiles = expertFiles;
    } else {
      dbFiles = files.map(f => ({ filename: f.originalname || f.filename, path: f.originalname || f.filename }));
      hashFiles = files.map(f => ({
        filename: f.originalname || f.filename,
        path: f.originalname || f.filename,
        content: f.buffer ? f.buffer.toString('utf-8') : f.content,
      }));
    }

    // 写入数据库
    const resource = resourceModel.create({
      name, display_name, type, description, author_id,
      current_version: version, tags,
      status: 'published',
      git_path: gitPath,
      files: dbFiles,
      platform: metadata.platform || null,  // 记录来源平台
    });

    // 创建版本记录
    versionModel.create({
      resource_id: resource.id,
      version,
      changelog: metadata.changelog || '初始版本',
      file_url: gitPath,
    });

    // 更新 content_hash（基于完整文件内容计算 SHA256）
    const contentHash = computeContentHash(hashFiles);
    resourceModel.update(resource.id, { content_hash: contentHash });

    // 设置标签
    if (tags.length > 0) {
      tagModel.setResourceTags(resource.id, resource.tags);
    }

    // 更新热度
    resourceModel.updateHotScore(resource.id);

    // 重新生成 manifest
    try { await manifestGenerator.regenerate(); } catch (e) {}

    return resourceModel.findById(resource.id);
  }

  async addVersion(resourceId, versionOrAuto, changelog, files) {
    const resource = resourceModel.findById(resourceId);
    if (!resource) {
      const err = new Error('资源不存在');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 确定实际版本号：如果 versionOrAuto 是 patch/minor/major 则自动递增，否则视为指定版本号
    let version;
    if (['patch', 'minor', 'major'].includes(versionOrAuto)) {
      version = incrementVersion(resource.current_version, versionOrAuto);
    } else {
      version = versionOrAuto;
    }

    const existingVersions = versionModel.findByResourceId(resourceId);
    if (existingVersions.find(v => v.version === version)) {
      const err = new Error(`版本 ${version} 已存在`);
      err.statusCode = 409;
      err.code = 'CONFLICT';
      throw err;
    }

    // 写入新版本文件到 Git
    // 同时收集带 content 的文件列表用于 content_hash 计算
    const hashFiles = files.map(f => ({
      filename: f.originalname || f.filename,
      path: f.originalname || f.filename,
      content: f.buffer ? f.buffer.toString('utf-8') : f.content,
    }));

    for (const file of files) {
      await gitStore.writeResourceFile(resource.name, version, file.originalname || file.filename, file.buffer ? file.buffer.toString('utf-8') : file.content);
    }

    // 更新 metadata.yaml
    const metadata = await gitStore.readMetadata(resource.name) || {};
    metadata.versions = metadata.versions || [];
    metadata.versions.push({
      version,
      date: new Date().toISOString().split('T')[0],
      changelog,
      entry_file: files[0]?.originalname || files[0]?.filename || 'README.md',
    });
    metadata.tags = resource.tags;
    await gitStore.writeMetadata(resource.name, metadata);

    await gitStore.commitAndPush(`feat: add version v${version} for ${resource.name}`);

    versionModel.create({
      resource_id: resourceId,
      version,
      changelog,
      file_url: `resources/${resource.name}/v${version}`,
    });

    resourceModel.update(resourceId, { current_version: version });

    // 更新 content_hash（基于新版本文件内容计算 SHA256）
    const contentHash = computeContentHash(hashFiles);
    resourceModel.update(resourceId, { content_hash: contentHash });

    resourceModel.updateHotScore(resourceId);

    try { await manifestGenerator.regenerate(); } catch (e) {}

    return resourceModel.findById(resourceId);
  }

  async getDownloadContent(resourceId, version) {
    const resource = resourceModel.findById(resourceId);
    if (!resource) {
      const err = new Error('资源不存在');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const ver = version || resource.current_version;
    const files = await gitStore.readResourceFiles(resource.name, ver);
    return { resource, version: ver, files };
  }

  async update(resourceId, data) {
    const resource = resourceModel.findById(resourceId);
    if (!resource) {
      const err = new Error('资源不存在');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (data.tags) {
      tagModel.setResourceTags(resourceId, data.tags);
    }

    return resourceModel.update(resourceId, data);
  }

  async delete(resourceId) {
    const resource = resourceModel.findById(resourceId);
    if (!resource) {
      const err = new Error('资源不存在');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    await gitStore.deleteResource(resource.name);
    await gitStore.commitAndPush(`chore: delete resource ${resource.name}`);

    resourceModel.delete(resourceId);

    try { await manifestGenerator.regenerate(); } catch (e) {}

    return { deleted: true };
  }
}

module.exports = new ResourceManager();
module.exports.parseExpertZip = parseExpertZip;
module.exports.countExpertAssets = countExpertAssets;
module.exports.incrementVersion = incrementVersion;
module.exports.computeContentHash = computeContentHash;
