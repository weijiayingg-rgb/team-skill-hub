const logger = require('../utils/logger');
const api = require('../api-client');

async function list(options) {
  const { type, platform, limit } = options;

  const spinner = logger.spinner('正在获取资源列表...');
  try {
    const result = await api.listResources({
      type: type || undefined,
      platform: platform || undefined,
      pageSize: limit || 20,
      sort: 'hot',
    });
    spinner.stop();

    const resources = result.data || [];
    if (resources.length === 0) {
      logger.warn('暂无资源');
      return;
    }

    logger.title(`资源列表 (${result.meta?.total || resources.length} 个)`);
    resources.forEach((r, i) => {
      const platformStr = (r.platforms || []).join(', ');
      logger.info(`${i + 1}. ${r.display_name}`);
      logger.info(`   ${r.name} | ${r.type} | v${r.current_version} | ${platformStr}`);
    });

  } catch (err) {
    spinner.stop();
    logger.error(`获取列表失败: ${err.message}`);
    process.exit(1);
  }
}

module.exports = list;
