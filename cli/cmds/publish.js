/**
 * publish 命令 — 发布资源到 SkillHub
 *
 * 智能打包逻辑：
 *   - 如果检测到 Expert 类型，自动解析 Skill 引用、收集关联文件、构建标准 ZIP 包
 *   - 普通类型（skill/rules/template/workflow/hook）直接上传文件
 *
 * Expert 打包流程：
 *   1. 读取 .md 文件，解析 Skill 路由表中的 /skill-name 引用
 *   2. 在 ~/.claude/commands/ 等目录搜索对应 Skill 文件
 *   3. 构建 ZIP：prompt.md + skills/*.md + expert.yaml
 *   4. 上传 ZIP 到服务端（服务端自动解析 ZIP 结构）
 */

const logger = require('../utils/logger');
const api = require('../api-client');
const { bundleExpert } = require('../utils/expert-bundler');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const axios = require('axios');
const inquirer = require('inquirer');

async function publish(publishPath, options) {
  const { type: resType, name: resName, platform: platforms } = options;

  // 验证路径
  const absPath = path.resolve(publishPath);
  if (!fs.existsSync(absPath)) {
    logger.error(`路径不存在: ${absPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(absPath);
  const files = [];

  if (stat.isFile()) {
    files.push(absPath);
  } else if (stat.isDirectory()) {
    // 递归读取所有文件（支持带子目录的 expert 包）
    collectFilesRecursive(absPath, files);
  }

  if (files.length === 0) {
    logger.error('未找到可上传的文件');
    process.exit(1);
  }

  // 尝试从 frontmatter 自动检测类型
  let detectedType = resType;
  if (!detectedType && files.length === 1) {
    const content = fs.readFileSync(files[0], 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const typeMatch = fmMatch[1].match(/^type:\s*(.+)$/m);
      if (typeMatch) detectedType = typeMatch[1].trim();
    }
    // 如果在 ~/.claude/agents/ 目录下，自动识别为 expert
    if (!detectedType) {
      const agentsDir = path.join(os.homedir(), '.claude', 'agents');
      if (files[0].startsWith(agentsDir)) detectedType = 'expert';
    }
  }

  // 收集元数据
  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: '资源名称 (kebab-case):', default: resName || path.basename(absPath, '.md') },
    { type: 'input', name: 'display_name', message: '显示名称:', default: path.basename(absPath, '.md') },
    {
      type: 'list',
      name: 'type',
      message: '资源类型:',
      choices: ['skill', 'rules', 'expert', 'template', 'workflow', 'hook'],
      default: detectedType || 'skill',
    },
    { type: 'input', name: 'description', message: '描述:' },
    {
      type: 'checkbox',
      name: 'platforms',
      message: '支持的平台:',
      choices: ['workbuddy', 'cursor', 'claude-code'],
      default: platforms?.split(',') || ['claude-code'],
    },
    { type: 'input', name: 'tags', message: '标签 (逗号分隔):', filter: (v) => v.split(',').map(t => t.trim()).filter(Boolean) },
  ]);

  // 构建表单数据
  const formData = new FormData();
  formData.append('name', answers.name);
  formData.append('display_name', answers.display_name);
  formData.append('type', answers.type);
  formData.append('description', answers.description);
  formData.append('platforms', JSON.stringify(answers.platforms));
  formData.append('tags', JSON.stringify(answers.tags));

  // ===== Expert 智能打包 =====
  if (answers.type === 'expert') {
    const expertFile = files[0]; // 取第一个文件作为 Expert 定义文件
    const bundleResult = bundleExpert(expertFile, { type: 'expert', verbose: false });

    if (bundleResult.isExpert && bundleResult.zipBuffer) {
      // 打印打包摘要
      console.log('');
      logger.info('📦 Expert 智能打包：');
      bundleResult.structure.forEach(s => {
        logger.info(`   ${s.path} (${s.size} bytes)`);
      });

      if (bundleResult.foundSkills.length > 0) {
        logger.success(`   找到 ${bundleResult.foundSkills.length} 个关联 Skill: ${bundleResult.foundSkills.map(s => s.name).join(', ')}`);
      }
      if (bundleResult.missingSkills.length > 0) {
        logger.warn(`   未找到 ${bundleResult.missingSkills.length} 个 Skill: ${bundleResult.missingSkills.join(', ')}`);
        logger.info('   提示：创建对应的 Skill 文件后重新发布可自动包含');
      }

      // 上传 ZIP 包
      formData.append('files', bundleResult.zipBuffer, `${answers.name}.zip`);
    } else {
      // Expert 但没有引用 → 直接上传文件
      for (const file of files) {
        const filename = path.basename(file);
        const content = fs.readFileSync(file);
        formData.append('files', content, filename);
      }
    }
  } else {
    // ===== 普通类型：直接上传文件 =====
    for (const file of files) {
      const filename = path.basename(file);
      const content = fs.readFileSync(file);
      formData.append('files', content, filename);
    }
  }

  const spinner = logger.spinner('正在发布资源...');
  try {
    const cfg = api.getConfig();
    const response = await axios.post(`${cfg.hubUrl}/api/resources`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${cfg.token}`,
      },
    });
    spinner.stop();

    const resource = response.data.data;
    logger.success('发布成功!');
    logger.info(`  名称: ${resource.display_name}`);
    logger.info(`  ID: ${resource.id}`);
    logger.info(`  类型: ${resource.type}`);
    logger.info(`  版本: ${resource.current_version}`);

    if (answers.type === 'expert') {
      logger.info('  包结构已解析，可在 Web 端查看文件树和 Skill 列表');
    }

  } catch (err) {
    spinner.stop();
    const message = err.response?.data?.error?.message || err.message;
    logger.error(`发布失败: ${message}`);
    process.exit(1);
  }
}

/**
 * 递归收集目录下所有文件
 * @param {string} dir - 目录路径
 * @param {string[]} result - 结果数组（原地追加）
 */
function collectFilesRecursive(dir, result) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, result);
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
}

module.exports = publish;
