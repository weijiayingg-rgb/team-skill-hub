const logger = require('../utils/logger');
const api = require('../api-client');

async function config(subCommand, keyValue) {
  const cfg = api.getConfig();

  if (!subCommand) {
    // 显示当前配置
    logger.title('当前配置');
    console.log(`  hub_url: ${cfg.hubUrl}`);
    console.log(`  token:   ${cfg.token.replace(/./g, '*')}`);
    return;
  }

  if (subCommand === 'set') {
    const parts = keyValue ? keyValue.split('=') : [];
    if (parts.length !== 2) {
      logger.error('格式错误。用法: skhub config set key=value');
      process.exit(1);
    }
    const [key, value] = parts;
    const validKeys = ['hub_url', 'token'];
    if (!validKeys.includes(key)) {
      logger.error(`无效的配置项: ${key}。可用: ${validKeys.join(', ')}`);
      process.exit(1);
    }
    api.setConfig(key, value);
    logger.success(`已设置 ${key} = ${key === 'token' ? '***' : value}`);
    return;
  }

  if (subCommand === 'get') {
    if (!keyValue) {
      logger.error('请指定要获取的配置项');
      process.exit(1);
    }
    if (keyValue === 'token') {
      logger.info(`${keyValue} = ${cfg[keyValue].replace(/./g, '*')}`);
    } else {
      logger.info(`${keyValue} = ${cfg[keyValue] || '(未设置)'}`);
    }
    return;
  }

  logger.error(`未知的配置子命令: ${subCommand}`);
}

module.exports = config;
