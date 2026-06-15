/**
 * import 命令
 * 扫描本地 AI 配置文件并导入到 SkillHub
 */

const logger = require('../utils/logger');
const api = require('../api-client');
const { scanAll } = require('../utils/scanner');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const inquirer = require('inquirer');

/**
 * 将单个资源上传到 SkillHub
 * @param {object} item - 扫描出的资源项
 * @param {number} index - 序号
 * @param {number} total - 总数
 * @returns {Promise<{success: boolean, name: string, error?: string}>}
 */
async function importOne(item, index, total) {
  const spinner = logger.spinner(`[${index}/${total}] 正在导入: ${item.displayName}`);

  try {
    // 构建 FormData，与 publish.js 保持一致
    const formData = new FormData();
    formData.append('name', item.name);
    formData.append('display_name', item.displayName);
    formData.append('type', item.type);
    formData.append('description', `从 ${item.platform} 自动导入`);
    formData.append('platforms', JSON.stringify([item.platform]));

    for (const file of item.files) {
      const content = fs.readFileSync(file);
      const filename = path.basename(file);
      formData.append('files', content, filename);
    }

    const cfg = api.getConfig();
    await axios.post(`${cfg.hubUrl}/api/resources`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${cfg.token}`,
      },
    });

    spinner.stop();
    logger.success(`[${index}/${total}] 导入成功: ${item.displayName}`);
    return { success: true, name: item.displayName };

  } catch (err) {
    spinner.stop();
    const message = err.response?.data?.error?.message || err.message;
    logger.error(`[${index}/${total}] 导入失败: ${item.displayName} - ${message}`);
    return { success: false, name: item.displayName, error: message };
  }
}

/**
 * import 命令入口
 * @param {object} options - 命令行选项
 * @param {string} [options.platform] - 限定平台
 * @param {string} [options.type] - 限定资源类型
 * @param {boolean} [options.dryRun] - 只列出不导入
 * @param {boolean} [options.yes] - 跳过确认全部导入
 */
async function importCommand(options) {
  const { platform, type, dryRun, yes } = options;

  // 1. 扫描可导入的资源
  const spinner = logger.spinner('正在扫描本地 AI 配置文件...');
  let items;
  try {
    items = scanAll({ platform, type });
  } catch (err) {
    spinner.stop();
    logger.error(`扫描失败: ${err.message}`);
    process.exit(1);
  }
  spinner.stop();

  // 2. 检查是否有可导入的资源
  if (items.length === 0) {
    const filterStr = [];
    if (platform) filterStr.push(`平台: ${platform}`);
    if (type) filterStr.push(`类型: ${type}`);
    const hint = filterStr.length > 0 ? `（筛选条件: ${filterStr.join(', ')}）` : '';
    logger.warn(`未发现可导入的本地配置${hint}`);
    logger.info('提示：请确保相关 AI 平台的配置文件存在于 HOME 目录下');
    return;
  }

  logger.success(`发现 ${items.length} 个可导入的资源:`);
  console.log('');
  items.forEach((item, i) => {
    console.log(`  ${i + 1}. [${item.platform}] ${item.displayName} (${item.type})`);
    console.log(`     文件: ${item.files.map(f => path.basename(f)).join(', ')}`);
  });
  console.log('');

  // 3. --dry-run 模式：只列出不导入
  if (dryRun) {
    logger.info('--dry-run 模式，未实际导入。移除 --dry-run 参数以执行导入。');
    return;
  }

  // 4. 选择要导入的资源
  let selectedItems;

  if (yes) {
    // --yes：跳过确认，全部导入
    selectedItems = items;
    logger.info(`使用 --yes，将导入全部 ${items.length} 个资源`);
  } else {
    // 交互式选择
    const choices = items.map((item, i) => ({
      name: `[${item.platform}] ${item.displayName} (${item.type})`,
      value: i,
      checked: true, // 默认全选
    }));

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: '请选择要导入的资源 (空格勾选，回车确认):',
        choices,
        pageSize: 15,
      },
    ]);

    if (answers.selected.length === 0) {
      logger.warn('未选择任何资源，已取消导入');
      return;
    }

    selectedItems = answers.selected.map(i => items[i]);
  }

  // 5. 逐个导入
  console.log('');
  logger.title('开始导入...');

  const results = [];
  for (let i = 0; i < selectedItems.length; i++) {
    const result = await importOne(selectedItems[i], i + 1, selectedItems.length);
    results.push(result);
  }

  // 6. 输出导入结果摘要
  console.log('');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  logger.title('导入完成');
  logger.success(`成功: ${successCount} 个`);

  if (failCount > 0) {
    logger.error(`失败: ${failCount} 个`);
    const failed = results.filter(r => !r.success);
    for (const f of failed) {
      logger.error(`  - ${f.name}: ${f.error}`);
    }
  }

  logger.info('提示：使用 skhub list 查看已导入的资源');
}

module.exports = importCommand;