const logger = require('../utils/logger');
const api = require('../api-client');

async function search(keyword, options) {
  const { type, platform, limit } = options;

  const spinner = logger.spinner(`搜索: "${keyword}"...`);
  try {
    const result = await api.searchResources(keyword, {
      type: type || undefined,
      platform: platform || undefined,
      pageSize: limit || 20,
    });
    spinner.stop();

    const resources = result.data || [];
    if (resources.length === 0) {
      logger.warn(`未找到匹配 "${keyword}" 的资源`);
      return;
    }

    logger.success(`找到 ${result.meta?.total || resources.length} 个资源:`);

    resources.forEach((r, i) => {
      const platformStr = (r.platforms || []).join(', ');
      logger.info(`  ${i + 1}. ${r.display_name} (${r.name})`);
      logger.info(`     类型: ${r.type} | 平台: ${platformStr} | 版本: ${r.current_version}`);
      logger.info(`     下载: ${r.download_count} | 赞: ${r.like_count} | 收藏: ${r.favorite_count}`);
      if (r.description) {
        logger.info(`     描述: ${r.description.substring(0, 80)}...`);
      }
      console.log('');
    });

  } catch (err) {
    spinner.stop();
    logger.error(`搜索失败: ${err.message}`);
    process.exit(1);
  }
}

module.exports = search;
