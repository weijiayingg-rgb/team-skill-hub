/**
 * 热度计算算法
 * Hacker News 风格: (收藏×5 + 评论×4 + 点赞×3 + 下载×2) / (时间差×24 + 2)^1.5
 */
class HeatCalculator {
  calculate(downloadCount, likeCount, favoriteCount, commentCount, createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const hoursDiff = (now - created) / (1000 * 60 * 60);

    const gravity = (downloadCount * 2.0)
      + (likeCount * 3.0)
      + (favoriteCount * 5.0)
      + (commentCount * 4.0);

    const decay = Math.pow(hoursDiff + 2.0, 1.5);

    return gravity / decay;
  }
}

module.exports = new HeatCalculator();
