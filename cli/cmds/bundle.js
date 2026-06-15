const logger = require('../utils/logger');
const api = require('../api-client');
const inquirer = require('inquirer');

async function bundle(subCommand, options) {
  if (!subCommand) {
    logger.error('请指定子命令: list, create, install');
    process.exit(1);
  }

  switch (subCommand) {
    case 'list':
      await listBundles();
      break;
    case 'create':
      await createBundle(options);
      break;
    case 'install':
      await installBundle(options);
      break;
    default:
      logger.error(`未知的 bundle 子命令: ${subCommand}`);
      process.exit(1);
  }
}

async function listBundles() {
  const spinner = logger.spinner('正在获取 Bundle 列表...');
  try {
    const result = await api.getBundles();
    spinner.stop();

    const bundles = result.data || [];
    if (bundles.length === 0) {
      logger.warn('暂无 Bundle');
      return;
    }

    logger.title('Bundle 列表');
    bundles.forEach((b, i) => {
      const resourceCount = (b.resources || []).length;
      logger.info(`${i + 1}. ${b.name} (${resourceCount} 个资源, v${b.version})`);
    });

  } catch (err) {
    spinner.stop();
    logger.error(`获取 Bundle 列表失败: ${err.message}`);
    process.exit(1);
  }
}

async function createBundle() {
  // 先获取可用资源列表
  const resources = await api.listResources({ pageSize: 100 });
  const resourceList = resources.data || [];

  if (resourceList.length === 0) {
    logger.error('没有可用资源');
    process.exit(1);
  }

  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Bundle 名称:' },
    { type: 'input', name: 'description', message: '描述:' },
    {
      type: 'checkbox',
      name: 'selectedResources',
      message: '选择包含的资源:',
      choices: resourceList.map(r => ({ name: `${r.display_name} (${r.name})`, value: r.name })),
    },
    {
      type: 'checkbox',
      name: 'platforms',
      message: '支持的平台:',
      choices: ['workbuddy', 'cursor', 'claude-code'],
    },
  ]);

  if (answers.selectedResources.length === 0) {
    logger.error('至少选择一个资源');
    process.exit(1);
  }

  const payload = {
    name: answers.name,
    description: answers.description,
    resources: answers.selectedResources,
    platforms: answers.platforms,
  };

  // Use axios directly for POST
  const axios = require('axios');
  const cfg = api.getConfig();
  const spinner = logger.spinner('正在创建 Bundle...');
  try {
    await axios.post(`${cfg.hubUrl}/api/bundles`, payload, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    spinner.stop();
    logger.success('Bundle 创建成功!');
  } catch (err) {
    spinner.stop();
    logger.error(`创建失败: ${err.response?.data?.error?.message || err.message}`);
    process.exit(1);
  }
}

async function installBundle(options) {
  const { name } = options;
  if (!name) {
    logger.error('请指定 Bundle 名称');
    process.exit(1);
  }

  logger.info(`Bundles 需要逐个安装资源，请使用 skhub install <name>`);
}

module.exports = bundle;
