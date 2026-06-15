const logger = require('../utils/logger');
const api = require('../api-client');
const fs = require('fs');
const path = require('path');
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
    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(path.join(absPath, entry.name));
      }
    }
  }

  if (files.length === 0) {
    logger.error('未找到可上传的文件');
    process.exit(1);
  }

  // 收集元数据
  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: '资源名称 (kebab-case):', default: resName || path.basename(absPath) },
    { type: 'input', name: 'display_name', message: '显示名称:', default: path.basename(absPath) },
    {
      type: 'list',
      name: 'type',
      message: '资源类型:',
      choices: ['skill', 'rules', 'expert', 'template', 'workflow', 'hook'],
      default: resType || 'skill',
    },
    { type: 'input', name: 'description', message: '描述:' },
    {
      type: 'checkbox',
      name: 'platforms',
      message: '支持的平台:',
      choices: ['workbuddy', 'cursor', 'claude-code'],
      default: platforms?.split(',') || ['workbuddy'],
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

  for (const file of files) {
    const filename = path.basename(file);
    const content = fs.readFileSync(file);
    formData.append('files', content, filename);
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

  } catch (err) {
    spinner.stop();
    const message = err.response?.data?.error?.message || err.message;
    logger.error(`发布失败: ${message}`);
    process.exit(1);
  }
}

module.exports = publish;
