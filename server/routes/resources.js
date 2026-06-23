const express = require('express');
const router = express.Router();
const AdmZip = require('adm-zip');
const resourceModel = require('../models/resources');
const resourceManager = require('../services/resource-manager');
const gitStore = require('../services/git-store');
const tagModel = require('../models/tags');
const interactionModel = require('../models/interactions');
const notificationModel = require('../models/notifications');
const { generateInstallPrompt } = require('../services/install-prompt');
const { getDb } = require('../models/db');
const upload = require('../middleware/upload');

/**
 * 获取 Expert 引用的 Skill 列表（expert_skill_refs 表 JOIN resources）
 * 供资源详情和 install-prompt 两个端点复用
 */
function getExpertSkillRefs(resourceId) {
  try {
    const db = getDb();
    return db.prepare(`
      SELECT esr.skill_name, esr.skill_id,
             r.display_name AS skill_display_name,
             r.type AS skill_type,
             r.current_version AS skill_version
      FROM expert_skill_refs esr
      LEFT JOIN resources r ON r.id = esr.skill_id
      WHERE esr.expert_id = ?
      ORDER BY esr.created_at
    `).all(resourceId);
  } catch {
    return [];
  }
}

// GET /api/resources - 列表
router.get('/', (req, res, next) => {
  try {
    const { type, types, status, sort, order, page, pageSize, q, tag } = req.query;
    const result = resourceModel.findAll({
      type, types, status, sort, order,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      q, tag,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/batch-check - 批量检查资源名称是否已上架
router.get('/batch-check', (req, res, next) => {
  try {
    const { names, type = 'skill' } = req.query;

    if (!names) {
      return res.status(400).json({
        success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 names 参数' },
      });
    }

    const nameList = names.split(',').map(n => n.trim()).filter(Boolean);

    if (nameList.length === 0 || nameList.length > 20) {
      return res.status(400).json({
        success: false, error: { code: 'VALIDATION_ERROR', message: 'names 参数需要 1~20 个名称（逗号分隔）' },
      });
    }

    const results = nameList.map(name => {
      const resource = resourceModel.findByName(name);
      if (resource && resource.type === type) {
        return { name, found: true, id: resource.id, display_name: resource.display_name || resource.name };
      }
      return { name, found: false, id: null, display_name: null };
    });

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/:id - 详情
router.get('/:id', async (req, res, next) => {
  try {
    const resource = resourceModel.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false, error: { code: 'NOT_FOUND', message: '资源不存在' },
      });
    }

    // 获取用户的互动状态
    let userInteractions = { liked: false, favorited: false };
    if (req.user?.id) {
      userInteractions = interactionModel.getUserInteractions(req.user.id, resource.id);
    }

    // 获取标签
    const resourceTags = tagModel.getResourceTags(resource.id);

    // 获取版本列表
    const versionList = (() => {
      try {
        return getDb().prepare('SELECT * FROM resource_versions WHERE resource_id = ? ORDER BY created_at DESC').all(resource.id);
      } catch { return []; }
    })();

    // Expert 类型：附带完整文件内容（从 Git 仓库递归读取）
    let expertFiles = undefined;
    let expertSkillRefs = []; // 引用模型：Expert 引用的 Skill 列表
    if (resource.type === 'expert') {
      try {
        const ver = resource.current_version;
        expertFiles = await gitStore.readResourceFiles(resource.name, ver);
      } catch {
        expertFiles = resource.files || [];
      }
      expertSkillRefs = getExpertSkillRefs(resource.id);
    }

    // Skill 类型：查询哪些 Expert 引用了此 Skill（反向引用）
    let referencedByExperts = [];
    if (resource.type === 'skill') {
      try {
        referencedByExperts = getDb().prepare(`
          SELECT r.id, r.name, r.display_name
          FROM expert_skill_refs esr
          JOIN resources r ON r.id = esr.expert_id
          WHERE esr.skill_id = ?
          ORDER BY r.display_name
        `).all(resource.id);
      } catch { /* 查询失败不影响主流程 */ }
    }

    res.json({
      success: true,
      data: {
        ...resource,
        tags_detail: resourceTags,
        versions: versionList,
        ...userInteractions,
        ...(expertFiles !== undefined ? { files: expertFiles } : {}),
        ...(expertSkillRefs.length > 0 ? { skill_refs: expertSkillRefs } : {}),
        ...(referencedByExperts.length > 0 ? { referenced_by_experts: referencedByExperts } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/resources - 上传创建
router.post('/', upload.array('files', 20), async (req, res, next) => {
  try {
    const { name, display_name, type, description, tags, changelog } = req.body;
    const author_id = req.user?.id || 1;

    if (!name || !display_name || !type) {
      return res.status(400).json({
        success: false, error: { code: 'VALIDATION_ERROR', message: '缺少必填字段: name, display_name, type' },
      });
    }

    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);

    const resource = await resourceManager.create({
      name, display_name, type, description, author_id, tags: parsedTags, changelog,
    }, req.files || []);

    res.status(201).json({ success: true, data: resource });
  } catch (err) {
    next(err);
  }
});

// PUT /api/resources/:id - 更新
router.put('/:id', async (req, res, next) => {
  try {
    const resource = await resourceManager.update(req.params.id, req.body, req.user);
    res.json({ success: true, data: resource });
  } catch (err) {
    next(err);
  }
});

// POST /api/resources/:id/versions - 新增版本
router.post('/:id/versions', upload.array('files', 20), async (req, res, next) => {
  try {
    const { version, auto_version, changelog } = req.body;

    // auto_version（patch/minor/major）或 version（指定版本号），必须提供其中一个
    const versionOrAuto = auto_version || version;
    if (!versionOrAuto) {
      return res.status(400).json({
        success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 version 或 auto_version 字段' },
      });
    }

    // 如果提供了 auto_version，校验其值必须是 patch/minor/major
    if (auto_version && !['patch', 'minor', 'major'].includes(auto_version)) {
      return res.status(400).json({
        success: false, error: { code: 'VALIDATION_ERROR', message: 'auto_version 仅支持 patch / minor / major' },
      });
    }

    const resource = await resourceManager.addVersion(req.params.id, versionOrAuto, changelog || '', req.files || []);
    res.status(201).json({ success: true, data: resource });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resources/:id - 删除
router.delete('/:id', async (req, res, next) => {
  try {
    await resourceManager.delete(req.params.id, req.user);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ZIP 文件大小限制（50MB）
const MAX_ZIP_SIZE = 50 * 1024 * 1024;

// GET /api/resources/:id/download-zip - ZIP 打包下载
router.get('/:id/download-zip', async (req, res, next) => {
  try {
    const { version } = req.query;
    const result = await resourceManager.getDownloadContent(req.params.id, version);

    // 检查总文件大小
    let totalSize = 0;
    for (const file of result.files) {
      totalSize += Buffer.byteLength(file.content, 'utf-8');
    }

    if (totalSize > MAX_ZIP_SIZE) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `资源文件总大小 (${(totalSize / 1024 / 1024).toFixed(1)}MB) 超过限制 (50MB)`,
        },
      });
    }

    // 用 adm-zip 打包所有文件
    const zip = new AdmZip();
    for (const file of result.files) {
      zip.addFile(file.filename, Buffer.from(file.content, 'utf-8'));
    }

    // 生成 ZIP 文件名：资源名-版本号.zip
    const zipFilename = `${result.resource.name}-v${result.version}.zip`;

    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);

    // 记录下载
    if (req.user?.id) {
      interactionModel.create(req.user.id, result.resource.id, 'download');

      // 发送下载通知（不给自己的资源发送通知，24 小时内去重）
      if (result.resource.author_id && result.resource.author_id !== req.user.id) {
        const displayName = result.resource.display_name || result.resource.name;
        if (!notificationModel.checkRecent(result.resource.author_id, result.resource.id, 'download', 24)) {
          notificationModel.create(
            result.resource.author_id,
            req.user.id,
            result.resource.id,
            'download',
            `下载了你的资源「${displayName}」`
          );
        }
      }
    }

    // 发送 ZIP 二进制流
    const zipBuffer = zip.toBuffer();
    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/:id/download - 下载文件（JSON 格式）
router.get('/:id/download', async (req, res, next) => {
  try {
    const { version } = req.query;
    const result = await resourceManager.getDownloadContent(req.params.id, version);

    // 记录下载
    if (req.user?.id) {
      interactionModel.create(req.user.id, result.resource.id, 'download');

      // 发送下载通知（不给自己的资源发送通知，24 小时内去重）
      if (result.resource.author_id && result.resource.author_id !== req.user.id) {
        const displayName = result.resource.display_name || result.resource.name;
        if (!notificationModel.checkRecent(result.resource.author_id, result.resource.id, 'download', 24)) {
          notificationModel.create(
            result.resource.author_id,
            req.user.id,
            result.resource.id,
            'download',
            `下载了你的资源「${displayName}」`
          );
        }
      }
    }

    res.json({
      success: true,
      data: {
        resource: result.resource,
        version: result.version,
        files: result.files,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/resources/:id/install-prompt - 生成安装提示词
router.get('/:id/install-prompt', async (req, res, next) => {
  try {
    const resource = resourceModel.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false, error: { code: 'NOT_FOUND', message: '资源不存在' },
      });
    }

    // 获取 Expert 的 skill_refs
    const skillRefs = resource.type === 'expert' ? getExpertSkillRefs(resource.id) : [];

    const resourceWithRefs = { ...resource, skill_refs: skillRefs };
    const result = generateInstallPrompt(resourceWithRefs);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
