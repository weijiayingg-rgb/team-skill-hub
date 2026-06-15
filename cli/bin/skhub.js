#!/usr/bin/env node

const { Command } = require('commander');
const pkg = require('../package.json');

const program = new Command();

program
  .name('skhub')
  .description('SkillHub CLI - 跨平台 AI 资源管理工具')
  .version(pkg.version);

// install 命令
program
  .command('install <name>')
  .description('安装资源到本地平台')
  .option('-p, --platform <platform>', '目标平台 (workbuddy|cursor|claude-code)')
  .option('-y, --yes', '跳过确认')
  .action(async (name, options) => {
    const install = require('../cmds/install');
    await install(name, options);
  });

// search 命令
program
  .command('search <keyword>')
  .description('搜索资源')
  .option('-t, --type <type>', '资源类型')
  .option('-p, --platform <platform>', '平台筛选')
  .option('-l, --limit <number>', '结果数量', parseInt)
  .action(async (keyword, options) => {
    const search = require('../cmds/search');
    await search(keyword, options);
  });

// publish 命令
program
  .command('publish <path>')
  .description('发布资源（推荐使用 push 命令）')
  .option('-t, --type <type>', '资源类型')
  .option('-n, --name <name>', '资源名称')
  .option('-p, --platform <platforms>', '支持的平台 (逗号分隔)')
  .action(async (publishPath, options) => {
    const publish = require('../cmds/publish');
    await publish(publishPath, options);
  });

// list 命令
program
  .command('list')
  .description('列出可用资源')
  .option('-t, --type <type>', '资源类型筛选')
  .option('-p, --platform <platform>', '平台筛选')
  .option('-l, --limit <number>', '结果数量', parseInt)
  .action(async (options) => {
    const list = require('../cmds/list');
    await list(options);
  });

// info 命令
program
  .command('info <name>')
  .description('查看资源详情')
  .action(async (name) => {
    const info = require('../cmds/info');
    await info(name);
  });

// config 命令
program
  .command('config [subCommand] [keyValue]')
  .description('管理配置 (set|get|无参数查看)')
  .action(async (subCommand, keyValue) => {
    const config = require('../cmds/config');
    await config(subCommand, keyValue);
  });

// bundle 命令
program
  .command('bundle [subCommand]')
  .description('管理 Bundle (list|create|install)')
  .option('-n, --name <name>', 'Bundle 名称')
  .action(async (subCommand, options) => {
    const bundle = require('../cmds/bundle');
    await bundle(subCommand, options);
  });

// import 命令
program
  .command('import')
  .description('扫描并导入本地 Skill（推荐使用 sync 命令）')
  .option('-p, --platform <platform>', '限定平台 (claude-code|cursor|workbuddy)')
  .option('-t, --type <type>', '限定资源类型 (skill|rules|expert|hook)')
  .option('--dry-run', '只列出可导入的资源，不实际导入')
  .option('-y, --yes', '跳过确认，全部导入')
  .action(async (options) => {
    const importCmd = require('../cmds/import');
    await importCmd(options);
  });

// push 命令
program
  .command('push [name]')
  .description('智能推送本地资源到 SkillHub (新增上传或版本更新)')
  .option('-a, --all', '推送所有新增和更新资源')
  .option('-n, --new', '仅推送新增资源')
  .option('-u, --update', '仅推送更新资源')
  .option('--dry-run', '只列出待推送资源，不实际推送')
  .action(async (name, options) => {
    const push = require('../cmds/push');
    await push(name, options);
  });

// scan 命令
program
  .command('scan')
  .description('扫描本地 AI 配置文件并比对远端状态')
  .option('-p, --platform <platform>', '限定平台 (claude-code|cursor|workbuddy)')
  .option('-t, --type <type>', '限定资源类型 (skill|expert)')
  .option('--json', '以 JSON 格式输出报告')
  .option('--dry-run', '只输出报告，不写入本地状态数据库')
  .action(async (options) => {
    const scan = require('../cmds/scan');
    await scan(options);
  });

// sync 命令
program
  .command('sync')
  .description('扫描本地 AI 配置并与 SkillHub 注册中心同步 (新增创建，更新推送版本)')
  .option('-a, --auto', '跳过交互选择，自动同步所有新增和更新资源')
  .option('-p, --platform <platform>', '限定平台 (claude-code|cursor|workbuddy)')
  .option('-t, --type <type>', '限定资源类型 (skill|expert)')
  .option('-w, --web <sessionId>', 'Web 协作模式：将扫描结果和推送结果同步到 Web 页面')
  .option('--dry-run', '只显示将要同步的内容，不实际推送')
  .action(async (options) => {
    const syncCmd = require('../cmds/sync');
    await syncCmd(options);
  });

program.parse(process.argv);