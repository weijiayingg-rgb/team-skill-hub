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
 *
 * 新格式（引用模型，推荐）：
 *   expert-name/
 *     expert.yaml        ← 声明引用的 Skill 名称列表
 *     prompt.md          ← 必须
 *     tools/*.json       ← 可选
 *     README.md
 *
 * 旧格式（嵌入模型，兼容）：
 *   expert-name/
 *     metadata.yaml
 *     prompt.md          ← 必须
 *     skills/*.md        ← 可选
 *     tools/*.json       ← 可选
 *     README.md
 *
 * 返回 { files: [{ filename, path, content }], valid: boolean, error?: string, skillRefs?: string[] }
 */
function parseExpertZip(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let entryPath = entry.entryName.replace(/\\/g, '/');
    // zip-slip 防护：在 normalize 之前检测原始路径中的 ..（因为 normalize 后 .. 可能已被路径跳转吃掉）
    if (/\.\./.test(entryPath)) {
      console.warn('[parseExpertZip] 拒绝可疑路径:', entryPath);
      continue; // 跳过此 entry，不加入 files
    }
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

  // 解析 expert.yaml（新格式：引用模型）
  const expertYamlFile = normalizedFiles.find(f => f.path === 'expert.yaml');
  let skillRefs = [];
  if (expertYamlFile) {
    try {
      const yaml = require('js-yaml');
      const config = yaml.load(expertYamlFile.content);
      if (config && Array.isArray(config.skills)) {
        skillRefs = config.skills.filter(s => typeof s === 'string' && s.trim());
      }
    } catch (e) {
      console.warn('[parseExpertZip] expert.yaml 解析失败:', e.message);
    }
  }

  return { files: normalizedFiles, valid: true, skillRefs };
}

/**
 * 统计 expert 包中的技能和工具数量
 * @param {Array} files - 文件列表
 * @param {string[]} skillRefs - expert.yaml 中声明的引用 Skill（可选）
 */
function countExpertAssets(files, skillRefs = []) {
  // 去重：已在 skillRefs 中声明的 skill 不算作"额外嵌入"，避免 skillCount 重复计算
  const refSkillSet = new Set(skillRefs);
  const embeddedSkills = files.filter(f =>
    f.path.startsWith('skills/') && f.filename.endsWith('.md') && !refSkillSet.has(f.filename.replace(/\.md$/, ''))
  );
  const tools = files.filter(f => f.path.startsWith('tools/'));
  return {
    skillCount: embeddedSkills.length + skillRefs.length,
    toolCount: tools.length,
    embeddedSkillCount: embeddedSkills.length + skillRefs.length,
    refSkillCount: skillRefs.length,
  };
}

/**
 * 在平台上查找 Skill 资源（多策略匹配）
 *
 * 匹配顺序：
 * 1. 精确匹配 findByName(skillName)
 * 2. 忽略大小写 + kebab-case 标准化后匹配
 * 3. 从数据库查所有 skill 类型资源做模糊比对（最后手段）
 *
 * @returns {object|null} 匹配到的资源或 null
 */
function findSkillOnPlatform(skillName) {
  // 策略 1：精确匹配
  const exact = resourceModel.findByName(skillName);
  if (exact && exact.type === 'skill') return exact;

  // 策略 2：kebab-case 标准化后匹配
  const kebab = skillName.toLowerCase().replace(/[_\s]+/g, '-');
  if (kebab !== skillName) {
    const normalized = resourceModel.findByName(kebab);
    if (normalized && normalized.type === 'skill') return normalized;
  }

  // 策略 3：忽略大小写查询（数据库 LIKE 匹配）
  try {
    const { getDb } = require('../models/db');
    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM resources WHERE LOWER(name) = LOWER(?) AND type = ? LIMIT 1'
    ).get(skillName, 'skill');
    if (row) {
      // 手动反序列化 JSON 字段（与 models/resources.js 的 deserialize 保持一致）
      try { row.tags = JSON.parse(row.tags); } catch { row.tags = []; }
      try { row.files = JSON.parse(row.files); } catch { row.files = []; }
      return row;
    }
  } catch (e) {
    // 查询失败不影响流程
  }

  return null;
}

/**
 * 自动从平台已有 Skill 资源拉取文件，准备嵌入到 Expert 包中
 *
 * 解决的问题：用户上传 Expert 时只传了 prompt.md（或 ZIP 不含 skills/），
 * 但 prompt.md 引用了平台上已存在的 Skill。此函数自动读取这些 Skill 的文件内容
 * 并返回文件列表，由调用方统一写入 Git。
 *
 * @param {string[]} skillRefs - 解析出的 Skill 引用名称列表
 * @param {Array} currentFiles - 当前 Expert 文件列表（含 path 字段）
 * @returns {{ added: Array, names: string[], skipped: Array<{name: string, reason: string}> }}
 */
async function autoEmbedSkills(skillRefs, currentFiles) {
  const result = { added: [], names: [], skipped: [] };
  if (!skillRefs || skillRefs.length === 0) return result;

  // 已嵌入的 skill（ZIP 中自带或前端归位的 skills/*.md）
  const embeddedSkills = new Set(
    currentFiles
      .filter(f => f.path && f.path.startsWith('skills/') && f.path.endsWith('.md'))
      .map(f => path.basename(f.path, '.md'))
  );

  for (const skillName of skillRefs) {
    // 已被前端归位或 ZIP 自带 → 跳过
    if (embeddedSkills.has(skillName)) {
      continue;
    }

    // 多策略查找平台上的 Skill
    const skill = findSkillOnPlatform(skillName);
    if (!skill) {
      result.skipped.push({ name: skillName, reason: '平台上未找到同名 Skill 资源' });
      continue;
    }

    try {
      const skillFiles = await gitStore.readResourceFiles(skill.name, skill.current_version);
      // 优先取 prompt.md，其次取主 .md 文件
      const mainFile = skillFiles.find(f => f.path === 'prompt.md')
        || skillFiles.find(f => f.path.endsWith('.md'));
      if (mainFile) {
        const skillPath = `skills/${skillName}.md`;
        // 不在此处写 Git，由调用方统一写入（避免重复写入）
        const addedFile = { path: skillPath, filename: `${skillName}.md`, content: mainFile.content };
        result.added.push(addedFile);
        result.names.push(skillName);
        embeddedSkills.add(skillName);
        console.log(`[auto-embed] 嵌入 Skill "${skillName}" → ${skillPath}`);
      } else {
        result.skipped.push({ name: skillName, reason: `Skill "${skill.name}" 在 Git 仓库中无 .md 文件` });
      }
    } catch (e) {
      result.skipped.push({ name: skillName, reason: `读取 Skill 文件失败: ${e.message}` });
      console.warn(`[auto-embed] 嵌入 Skill "${skillName}" 失败:`, e.message);
    }
  }

  return result;
}

/**
 * 从文件列表中提取 Skill 引用（expert.yaml + prompt.md 兜底取并集）
 * @param {Array} expertFiles - Expert 文件列表（含 path, filename, content）
 * @returns {string[]} Skill 引用名称列表
 */
function extractSkillRefsFromFiles(expertFiles) {
  const refs = [];
  const seen = new Set();

  // 1. 从 expert.yaml 提取
  const yamlFile = expertFiles.find(f => f.path === 'expert.yaml' || f.filename === 'expert.yaml');
  if (yamlFile) {
    try {
      const yaml = require('js-yaml');
      const config = yaml.load(yamlFile.content);
      if (config && Array.isArray(config.skills)) {
        for (const s of config.skills) {
          if (typeof s === 'string' && s.trim() && !seen.has(s)) {
            refs.push(s);
            seen.add(s);
          }
        }
      }
    } catch (e) {
      console.warn('[resource-manager] expert.yaml 解析失败:', e.message);
    }
  }

  // 2. 兜底：从 prompt.md 正文提取 Skill 引用（与 expert.yaml 取并集）
  const promptFile = expertFiles.find(f => f.path === 'prompt.md');
  if (promptFile) {
    try {
      const { parseSkillRefs } = require('../../shared/expert-rules');
      const { refs: bodyRefs } = parseSkillRefs(promptFile.content);
      for (const r of bodyRefs) {
        if (!seen.has(r)) {
          refs.push(r);
          seen.add(r);
        }
      }
    } catch (e) {
      console.warn('[resource-manager] prompt.md skill refs 解析失败:', e.message);
    }
  }

  return refs;
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

    // ===== Expert 类型处理 =====
    // 重构后的执行顺序：解析文件 → 提取 Skill 引用 → 自动嵌入缺失 Skill → 统一写 Git
    let expertFiles = [];
    let expertSkillRefs = [];
    let autoEmbedResult = { added: [], names: [], skipped: [] }; // 记录自动嵌入的 Skill，返回给前端

    if (type === 'expert' && files.length === 1 && files[0].originalname?.toLowerCase().endsWith('.zip')) {
      // ── ZIP 包上传分支 ──
      const zipFile = files[0];
      const parsed = parseExpertZip(zipFile.buffer);
      if (!parsed.valid) {
        const err = new Error(parsed.error);
        err.statusCode = 400;
        err.code = 'INVALID_EXPERT_PACKAGE';
        throw err;
      }
      expertFiles = parsed.files;
      expertSkillRefs = parsed.skillRefs || [];

      // 补充：从 prompt.md 正文提取（与 expert.yaml 取并集）
      const moreRefs = extractSkillRefsFromFiles(expertFiles);
      const seen = new Set(expertSkillRefs);
      for (const r of moreRefs) {
        if (!seen.has(r)) { expertSkillRefs.push(r); seen.add(r); }
      }

      // 自动嵌入平台上已有的 Skill 文件
      await gitStore.ensureResourceDir(name, version);
      autoEmbedResult = await autoEmbedSkills(expertSkillRefs, expertFiles);
      expertFiles.push(...autoEmbedResult.added);

      // 统一写入所有文件到 Git（原始 + 自动嵌入）
      for (const file of expertFiles) {
        await gitStore.writeResourceFile(name, version, file.path, file.content);
      }
    } else if (type === 'expert') {
      // ── 非 ZIP 多文件上传分支 ──
      //
      // 路径规范化策略（消除多文件时 array 顺序赌概率的问题）：
      //   1. 如果已有 prompt.md → 直接使用，不重命名
      //   2. 单文件 .md → 重命名为 prompt.md
      //   3. 多文件无 prompt.md → 按文件名匹配资源 name（`${name}.md`）重命名，
      //      找不到匹配时报 400（避免随机选择错误 .md）
      await gitStore.ensureResourceDir(name, version);

      expertFiles = files.map(f => {
        const content = f.buffer ? f.buffer.toString('utf-8') : f.content;
        const rawPath = f.path || f.originalname || f.filename;
        return { rawPath, filename: f.originalname || f.filename, content };
      });

      // 规范化路径
      const hasPromptMd = expertFiles.some(f =>
        f.rawPath === 'prompt.md' || f.filename === 'prompt.md'
      );

      if (hasPromptMd) {
        for (const f of expertFiles) { f.path = f.rawPath; }
      } else if (expertFiles.length === 1 && expertFiles[0].filename.endsWith('.md')) {
        expertFiles[0].path = 'prompt.md';
      } else if (expertFiles.length > 1) {
        const nameMatch = expertFiles.find(f =>
          f.filename === `${name}.md` || f.rawPath === `${name}.md`
        );
        if (nameMatch) {
          nameMatch.path = 'prompt.md';
          for (const f of expertFiles) { if (f !== nameMatch) f.path = f.rawPath; }
        } else {
          const err = new Error('多文件 Expert 上传需包含 prompt.md 或与资源名同名的 .md 文件');
          err.statusCode = 400;
          err.code = 'INVALID_EXPERT_PACKAGE';
          throw err;
        }
      }

      // 提取 Skill 引用（expert.yaml + prompt.md 兜底取并集）
      expertSkillRefs = extractSkillRefsFromFiles(expertFiles);

      // 自动嵌入平台上已有的 Skill 文件
      autoEmbedResult = await autoEmbedSkills(expertSkillRefs, expertFiles);
      expertFiles.push(...autoEmbedResult.added);

      // 统一写入所有文件到 Git（原始 + 自动嵌入）
      for (const file of expertFiles) {
        await gitStore.writeResourceFile(name, version, file.path, file.content);
      }
    } else {
      // 非 expert 或普通文件上传 → 原有逻辑
      await gitStore.ensureResourceDir(name, version);
      for (const file of files) {
        const writePath = file.path || file.originalname || file.filename;
        await gitStore.writeResourceFile(name, version, writePath, file.buffer ? file.buffer.toString('utf-8') : file.content);
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
    let hashFiles; // 用于计算 content_hash 的文件列表
    if (type === 'expert' && expertFiles.length > 0) {
      dbFiles = expertFiles.map(f => ({ filename: f.filename, path: f.path }));
      // Expert 哈希只算源文件（排除 skills/ 目录），与服务端 computeLocalHash 对齐
      // skills/ 下的文件是自动嵌入或手动上传的派生内容，不参与哈希比较
      // 这样扫描器重扫时不会因为嵌入文件导致哈希不匹配误判为"有更新"
      hashFiles = expertFiles.filter(f => !f.path || !f.path.startsWith('skills/'));
    } else {
      dbFiles = files.map(f => ({ filename: f.originalname || f.filename, path: f.path || f.originalname || f.filename }));
      hashFiles = files.map(f => ({
        filename: f.originalname || f.filename,
        path: f.path || f.originalname || f.filename,
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

    // 存储 Expert 引用的 Skill 关系（引用模型）
    if (type === 'expert' && expertSkillRefs.length > 0) {
      const { getDb } = require('../models/db');
      const db = getDb();
      const insertRef = db.prepare(
        'INSERT OR IGNORE INTO expert_skill_refs (expert_id, skill_name, skill_id) VALUES (?, ?, ?)'
      );
      for (const skillName of expertSkillRefs) {
        // 尝试查找平台上已存在的同名 Skill（仅匹配 skill 类型）
        const skill = resourceModel.findByName(skillName);
        insertRef.run(resource.id, skillName, (skill && skill.type === 'skill') ? skill.id : null);
      }
    }

    // Expert 类型：计算并缓存技能/工具数量（供列表接口直接读取，避免每次读 Git）
    if (type === 'expert' && expertFiles.length > 0) {
      const counts = countExpertAssets(expertFiles, expertSkillRefs);
      resourceModel.update(resource.id, {
        skill_count: counts.skillCount,
        tool_count: counts.toolCount,
      });
    }

    // 更新热度
    resourceModel.updateHotScore(resource.id);

    // 重新生成 manifest
    try { await manifestGenerator.regenerate(); } catch (e) {}

    const result = resourceModel.findById(resource.id);

    // 附加自动嵌入信息（供前端展示反馈）
    if (autoEmbedResult.names.length > 0 || autoEmbedResult.skipped.length > 0) {
      result.autoEmbeddedSkills = autoEmbedResult.names;
      result.skippedSkills = autoEmbedResult.skipped;
    }

    return result;
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
    let hashFiles;
    let newSkillRefs = []; // Expert 的新引用列表（空数组 = "没有引用"）
    let isExpertVersion = false; // 标记是否走到了 Expert 处理分支

    // Expert ZIP 包处理（与 create 保持一致）
    if (resource.type === 'expert' && files.length === 1 && files[0].originalname?.toLowerCase().endsWith('.zip')) {
      isExpertVersion = true;
      const parsed = parseExpertZip(files[0].buffer);
      if (!parsed.valid) {
        const err = new Error(parsed.error);
        err.statusCode = 400;
        err.code = 'INVALID_EXPERT_PACKAGE';
        throw err;
      }
      newSkillRefs = parsed.skillRefs || [];

      // 补充：从 prompt.md 正文提取（与 expert.yaml 取并集）
      const moreRefs = extractSkillRefsFromFiles(parsed.files);
      const seen = new Set(newSkillRefs);
      for (const r of moreRefs) {
        if (!seen.has(r)) { newSkillRefs.push(r); seen.add(r); }
      }

      hashFiles = parsed.files;

      // 自动嵌入平台上已有的 Skill 文件
      await gitStore.ensureResourceDir(resource.name, version);
      const autoEmbed = await autoEmbedSkills(newSkillRefs, parsed.files);
      parsed.files.push(...autoEmbed.added);
      // Expert 哈希排除 skills/ 目录（与 computeLocalHash 对齐）
      hashFiles = parsed.files.filter(f => !f.path || !f.path.startsWith('skills/'));

      // 统一写入所有文件到 Git
      for (const file of parsed.files) {
        await gitStore.writeResourceFile(resource.name, version, file.path, file.content);
      }
    } else if (resource.type === 'expert') {
      isExpertVersion = true;
      // Expert 非 ZIP 上传 → 自动规范化为标准包结构（与 create 保持一致）
      const normalizedFiles = files.map(f => {
        const content = f.buffer ? f.buffer.toString('utf-8') : f.content;
        const rawPath = f.path || f.originalname || f.filename;
        return { rawPath, filename: f.originalname || f.filename, content };
      });

      const hasPromptMd = normalizedFiles.some(f =>
        f.rawPath === 'prompt.md' || f.filename === 'prompt.md'
      );

      if (hasPromptMd) {
        for (const f of normalizedFiles) { f.path = f.rawPath; }
      } else if (normalizedFiles.length === 1 && normalizedFiles[0].filename.endsWith('.md')) {
        normalizedFiles[0].path = 'prompt.md';
      } else if (normalizedFiles.length > 1) {
        const nameMatch = normalizedFiles.find(f =>
          f.filename === `${resource.name}.md` || f.rawPath === `${resource.name}.md`
        );
        if (nameMatch) {
          nameMatch.path = 'prompt.md';
          for (const f of normalizedFiles) { if (f !== nameMatch) f.path = f.rawPath; }
        } else {
          const err = new Error('多文件 Expert 上传需包含 prompt.md 或与资源名同名的 .md 文件');
          err.statusCode = 400;
          err.code = 'INVALID_EXPERT_PACKAGE';
          throw err;
        }
      }

      // 提取 Skill 引用（expert.yaml + prompt.md 兜底取并集）
      newSkillRefs = extractSkillRefsFromFiles(normalizedFiles);

      // 自动嵌入平台上已有的 Skill 文件
      await gitStore.ensureResourceDir(resource.name, version);
      const autoEmbed = await autoEmbedSkills(newSkillRefs, normalizedFiles);
      normalizedFiles.push(...autoEmbed.added);

      hashFiles = normalizedFiles
        .filter(f => !f.path || !f.path.startsWith('skills/'))
        .map(f => ({ filename: f.filename, path: f.path, content: f.content }));

      // 统一写入所有文件到 Git
      for (const file of normalizedFiles) {
        await gitStore.writeResourceFile(resource.name, version, file.path, file.content);
      }
    } else {
      hashFiles = files.map(f => ({
        filename: f.originalname || f.filename,
        path: f.path || f.originalname || f.filename,
        content: f.buffer ? f.buffer.toString('utf-8') : f.content,
      }));

      for (const file of files) {
        const writePath = file.path || file.originalname || file.filename;
        await gitStore.writeResourceFile(resource.name, version, writePath, file.buffer ? file.buffer.toString('utf-8') : file.content);
      }
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

    // Expert 版本更新时同步更新 skill 引用关系
    // isExpertVersion 标记是否走到了 Expert 处理分支（无论有无引用都要更新）
    if (isExpertVersion) {
      const { getDb } = require('../models/db');
      const db = getDb();
      // 先清除旧引用，再写入新引用
      db.prepare('DELETE FROM expert_skill_refs WHERE expert_id = ?').run(resourceId);
      const insertRef = db.prepare(
        'INSERT OR IGNORE INTO expert_skill_refs (expert_id, skill_name, skill_id) VALUES (?, ?, ?)'
      );
      for (const skillName of newSkillRefs) {
        const skill = resourceModel.findByName(skillName);
        insertRef.run(resourceId, skillName, (skill && skill.type === 'skill') ? skill.id : null);
      }

      // 更新技能/工具数量缓存（基于新版本文件列表 + 引用列表）
      const counts = countExpertAssets(hashFiles || [], newSkillRefs);
      resourceModel.update(resourceId, {
        skill_count: counts.skillCount,
        tool_count: counts.toolCount,
      });
    }

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

  async update(resourceId, data, user) {
    const resource = resourceModel.findById(resourceId);
    if (!resource) {
      const err = new Error('资源不存在');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 权限校验：仅作者和管理员可更新
    if (user && resource.author_id !== user.id && user.role !== 'admin') {
      const err = new Error('无权修改此资源');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (data.tags !== undefined) {
      tagModel.setResourceTags(resourceId, data.tags);
    }

    return resourceModel.update(resourceId, data);
  }

  async delete(resourceId, user) {
    const resource = resourceModel.findById(resourceId);
    if (!resource) {
      const err = new Error('资源不存在');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 权限校验：仅作者和管理员可删除
    if (user && resource.author_id !== user.id && user.role !== 'admin') {
      const err = new Error('无权删除此资源');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
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
