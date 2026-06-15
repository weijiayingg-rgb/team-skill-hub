const logger = require('../utils/logger');
const api = require('../api-client');

async function info(name) {
  const spinner = logger.spinner(`正在获取资源信息: ${name}...`);
  try {
    // 先搜索
    const searchResult = await api.getResourceByName(name);
    const resources = searchResult.data || [];

    if (resources.length === 0) {
      spinner.stop();
      logger.error(`未找到资源: ${name}`);
      process.exit(1);
    }

    const resource = resources[0];
    spinner.stop();

    logger.title(resource.display_name);
    console.log(`  标识:       ${resource.name}`);
    console.log(`  类型:       ${resource.type}`);
    console.log(`  版本:       ${resource.current_version}`);
    console.log(`  平台:       ${(resource.platforms || []).join(', ')}`);
    console.log(`  标签:       ${(resource.tags || []).join(', ') || '-'}`);
    console.log(`  作者:       ${resource.author_display_name || resource.author_name}`);
    console.log(`  下载:       ${resource.download_count}`);
    console.log(`  赞:         ${resource.like_count}`);
    console.log(`  收藏:       ${resource.favorite_count}`);
    console.log(`  评论:       ${resource.comment_count}`);
    console.log(`  热度:       ${resource.hot_score?.toFixed(2) || '-'}`);
    console.log(`  创建:       ${resource.created_at}`);
    console.log(`  状态:       ${resource.status}`);
    if (resource.description) {
      console.log(`  描述:`);
      console.log(`    ${resource.description}`);
    }

    // 获取版本列表
    const detailResult = await api.getResource(resource.id);
    const detail = detailResult.data;
    if (detail?.versions?.length > 0) {
      console.log(`\n  版本历史:`);
      detail.versions.forEach(v => {
        console.log(`    v${v.version} - ${v.changelog || '-'} (${v.created_at})`);
      });
    }

  } catch (err) {
    spinner.stop();
    logger.error(`获取信息失败: ${err.message}`);
    process.exit(1);
  }
}

module.exports = info;
