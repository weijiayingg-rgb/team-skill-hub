const logger = require('../utils/logger');
const api = require('../api-client');
const { detectPlatforms, getBasePath } = require('../utils/platform-detect');
const { getAdapterModule } = require('../install-adapters');
const inquirer = require('inquirer');

async function install(name, options) {
  const { platform: targetPlatform, yes } = options;

  const spinner = logger.spinner(`正在搜索资源: ${name}...`);
  try {
    // 搜索资源
    const result = await api.getResourceByName(name);
    spinner.stop();

    const resources = result.data || [];
    if (resources.length === 0) {
      logger.error(`未找到资源: ${name}`);
      process.exit(1);
    }

    const resource = resources[0];
    logger.success(`找到资源: ${resource.display_name} (v${resource.current_version})`);

    // 确定目标平台
    let platform = targetPlatform;
    if (!platform) {
      const available = detectPlatforms();
      if (available.length === 0) {
        logger.error('未检测到已安装的平台 (WorkBuddy/Cursor/Claude Code)');
        process.exit(1);
      }

      const { selected } = await inquirer.prompt([{
        type: 'list',
        name: 'selected',
        message: '选择目标平台:',
        choices: available,
      }]);
      platform = selected;
    }

    // 确认安装
    if (!yes) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `确认安装 ${resource.name} 到 ${platform}?`,
        default: true,
      }]);
      if (!confirm) {
        logger.info('已取消安装');
        return;
      }
    }

    // 下载资源文件
    const downloadSpinner = logger.spinner('正在下载资源文件...');
    const downloadResult = await api.downloadResource(resource.id, resource.current_version);
    downloadSpinner.stop();

    const downloadData = downloadResult.data || downloadResult;
    const { files } = downloadData;

    if (!files || files.length === 0) {
      logger.error('资源文件为空');
      process.exit(1);
    }

    // 安装到目标平台
    const installSpinner = logger.spinner(`正在安装到 ${platform}...`);
    const { getAdapter } = getAdapterModule();
    const adapter = getAdapter(platform);
    const basePath = getBasePath();

    const installResult = await adapter.install({
      type: resource.type,
      name: resource.name,
      display_name: resource.display_name,
      description: resource.description,
      files: files,
      metadata: resource,
    }, basePath);

    installSpinner.stop();

    // 记录下载
    try { await api.recordDownload(resource.id); } catch (e) {}

    logger.success(`安装成功!`);
    logger.info(`  路径: ${installResult.installedPath}`);
    if (installResult.convertedFiles.length > 0) {
      logger.info(`  文件数: ${installResult.convertedFiles.length}`);
    }

  } catch (err) {
    spinner.stop();
    logger.error(`安装失败: ${err.message}`);
    process.exit(1);
  }
}

module.exports = install;
