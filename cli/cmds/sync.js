/**
 * sync 命令 — 扫描本地 AI 配置并与 SkillHub 注册中心同步
 *
 * 三阶段流程：
 *   Phase 1: scan — 扫描本地资源，计算指纹，与远端比对，判定 new / updated / synced 状态
 *   Phase 2: select — 交互式选择需要同步的资源（checkbox，显示状态图标）
 *   Phase 3: push — 对选中资源逐个执行推送（new → 创建资源，updated → 添加版本）
 *
 * --web 协作模式（Phase 2/3 由 Web 端接管）：
 *   Phase 1: scan — 扫描本地资源 + POST scan 结果到 server
 *   Phase 2: select — 输出 session_id 提示 → 轮询等待 Web 的 push_plan
 *   Phase 3: push — 按 push_plan 推送，每完成一个就 POST 增量结果
 *
 * 选项：
 *   --auto / -a       跳过交互选择，自动同步所有 new + updated 资源
 *   --platform / -p   限定平台 (claude-code|cursor|workbuddy)
 *   --type / -t       限定资源类型 (skill|expert)
 *   --dry-run         只显示将要同步的内容，不实际执行推送
 *   --web / -w        Web 协作模式：将扫描结果和推送结果同步到 Web 页面
 */

const logger = require('../utils/logger');
const api = require('../api-client');
const webSync = require('../utils/web-sync');
const { scanAll, resolvePlatform } = require('../utils/scanner');
const { generateFingerprint } = require('../utils/fingerprint');
const localState = require('../utils/local-state');
const inquirer = require('inquirer').default || require('inquirer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const chalk = require('chalk').default || require('chalk');

// ──────────────────────────── 状态图标定义 ────────────────────────────

const STATUS_ICONS = {
  new:     chalk.green('+'),     // 本地新增，远端不存在
  updated: chalk.yellow('~'),    // 本地有变更，远端版本过旧
  synced:  chalk.gray('='),      // 指纹一致，无需同步
  local:   chalk.blue('?'),      // 尚未与远端比对
};

const STATUS_LABELS = {
  new:     '新增',
  updated: '有更新',
  synced:  '已同步',
  local:   '未比对',
};

// ──────────────────────────── Phase 1: scan ────────────────────────────

/**
 * Phase 1: 扫描本地资源、计算指纹、写入 local-state、与远端比对
 *
 * @param {object} options - 命令行选项
 * @param {string} [options.platform] - 限定平台
 * @param {string} [options.type] - 限定资源类型
 * @returns {object[]} 带状态信息的资源列表
 */
async function phaseScan(options) {
  const resolvedPlatform = resolvePlatform(options.platform);
  const { type } = options;

  // 1.1 扫描本地 AI 配置文件
  const scanSpinner = logger.spinner('正在扫描本地 AI 配置文件...');
  let items;
  try {
    items = scanAll({ platform: resolvedPlatform, type });
  } catch (err) {
    scanSpinner.stop();
    logger.error(`扫描失败: ${err.message}`);
    process.exit(1);
  }
  scanSpinner.stop();

  if (items.length === 0) {
    const filterStr = [];
    if (resolvedPlatform) filterStr.push(`平台: ${resolvedPlatform}`);
    if (type) filterStr.push(`类型: ${type}`);
    const hint = filterStr.length > 0 ? `（筛选条件: ${filterStr.join(', ')}）` : '';
    logger.warn(`未发现本地配置${hint}`);
    return [];
  }

  // 1.2 计算指纹并写入 local-state
  for (const item of items) {
    const fp = generateFingerprint(item);
    localState.upsertSkill({
      name: item.name,
      type: item.type,
      platform: item.platform,
      display_name: item.displayName,
      content_hash: fp.collectionHash,
      file_paths: item.files,
      status: 'local', // 初始标记为 local，待远端比对后更新
    });
  }

  // 1.3 获取远端指纹映射
  const remoteSpinner = logger.spinner('正在获取远端指纹映射...');
  let fingerprintMap;
  try {
    const result = await api.getFingerprintMap();
    fingerprintMap = result.data || {};
  } catch (err) {
    remoteSpinner.stop();
    logger.warn(`获取远端指纹映射失败: ${err.message}，将全部标记为未比对`);
    fingerprintMap = {};
  }
  remoteSpinner.stop();

  // 1.4 与远端比对，更新 local-state 中的状态
  const summary = localState.compareWithRemote(fingerprintMap);

  logger.success(`扫描完成: ${items.length} 个本地资源`);
  logger.info(`  ${STATUS_ICONS.new} 新增: ${summary.new}  ${STATUS_ICONS.updated} 有更新: ${summary.updated}  ${STATUS_ICONS.synced} 已同步: ${summary.synced}${summary.local > 0 ? `  ${STATUS_ICONS.local} 未比对: ${summary.local}` : ''}`);

  // 1.5 从 local-state 读取完整记录（包含比对后的状态）
  const allSkills = localState.getAllSkills();

  // 只返回符合 resolvedPlatform / type 过滤条件的记录
  const filtered = allSkills.filter(skill => {
    if (resolvedPlatform && skill.platform !== resolvedPlatform) return false;
    if (type && skill.type !== type) return false;
    return true;
  });

  return filtered;
}

// ──────────────────────────── Phase 2: select ────────────────────────────

/**
 * Phase 2: 选择需要同步的资源
 *
 * 通过 inquirer checkbox 展示资源列表，带状态图标。
 * new 和 updated 默认勾选，synced 默认不勾选。
 * --auto 模式下跳过交互，自动选中所有 new + updated。
 *
 * @param {object[]} skills - 带状态信息的资源列表
 * @param {object} options - 命令行选项
 * @param {boolean} [options.auto] - 跳过交互，自动选中
 * @returns {object[]} 选中的资源列表
 */
async function phaseSelect(skills, options) {
  const { auto } = options;

  // 筛选出可以同步的资源（排除 synced）
  const syncable = skills.filter(s => s.status !== 'synced');

  if (syncable.length === 0) {
    logger.info('所有资源已与远端同步，无需操作');
    return [];
  }

  // --auto 模式：直接选中所有 new + updated
  if (auto) {
    const selected = skills.filter(s => s.status === 'new' || s.status === 'updated');
    if (selected.length === 0) {
      logger.info('没有需要同步的新增或更新资源');
      return [];
    }
    logger.info(`--auto 模式：将同步 ${selected.length} 个资源`);
    return selected;
  }

  // 交互式选择
  // 按 platform:type:name 格式展示，带状态图标
  const choices = skills.map((skill, i) => {
    const icon = STATUS_ICONS[skill.status] || STATUS_ICONS.local;
    const label = STATUS_LABELS[skill.status] || '未知';
    const displayName = skill.display_name || skill.name;
    const choiceText = `${icon} [${skill.platform}] ${displayName} (${skill.type}) — ${label}`;

    return {
      name: choiceText,
      value: i,
      // new 和 updated 默认勾选，synced 和 local 默认不勾选
      checked: skill.status === 'new' || skill.status === 'updated',
    };
  });

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: '请选择要同步的资源 (空格勾选，回车确认):',
      choices,
      pageSize: 15,
    },
  ]);

  if (answers.selected.length === 0) {
    logger.warn('未选择任何资源，已取消同步');
    return [];
  }

  return answers.selected.map(i => skills[i]);
}

// ──────────────────────────── Phase 3: push ────────────────────────────

/**
 * Phase 3: 对选中资源逐个执行推送
 *
 * 推送逻辑：
 *   - new 资源 → POST /api/resources（创建新资源）
 *   - updated 资源 → POST /api/resources/:id/versions（添加新版本）
 *
 * @param {object[]} selectedSkills - 选中的资源列表
 * @param {object} options - 命令行选项
 * @param {boolean} [options.dryRun] - 只显示不实际推送
 * @returns {object[]} 推送结果数组
 */
async function phasePush(selectedSkills, options) {
  const { dryRun } = options;
  const results = [];

  console.log('');
  logger.title(dryRun ? 'Dry Run — 以下资源将被同步:' : '开始同步...');

  for (let i = 0; i < selectedSkills.length; i++) {
    const skill = selectedSkills[i];
    const displayName = skill.display_name || skill.name;
    const indexLabel = `[${i + 1}/${selectedSkills.length}]`;

    // --dry-run: 只显示不执行
    if (dryRun) {
      const icon = STATUS_ICONS[skill.status];
      const action = skill.status === 'new' ? '创建新资源' : '添加新版本';
      logger.info(`${indexLabel} ${icon} ${displayName} — ${action}`);
      results.push({ success: true, name: displayName, action, dryRun: true });
      continue;
    }

    const spinner = logger.spinner(`${indexLabel} 正在同步: ${displayName}`);

    try {
      if (skill.status === 'new') {
        // 新增：创建资源 (POST /api/resources)
        const result = await pushNewResource(skill);
        spinner.stop();

        // 更新 local-state 的远端信息
        localState.updateRemoteInfo(
          skill.name,
          skill.content_hash,
          result.id,
          result.current_version,
          'synced'
        );

        logger.success(`${indexLabel} 创建成功: ${displayName} (v${result.current_version})`);
        results.push({ success: true, name: displayName, action: '创建新资源', id: result.id });

      } else if (skill.status === 'updated') {
        // 更新：添加版本 (POST /api/resources/:id/versions)
        const result = await pushUpdatedResource(skill);
        spinner.stop();

        // 更新 local-state 的远端信息
        localState.updateRemoteInfo(
          skill.name,
          skill.content_hash,
          skill.remote_id,
          result.current_version,
          'synced'
        );

        logger.success(`${indexLabel} 更新成功: ${displayName} → v${result.current_version}`);
        results.push({ success: true, name: displayName, action: '添加新版本', id: skill.remote_id });

      } else {
        // 其他状态（synced/local）不应出现在推送阶段，跳过
        spinner.stop();
        logger.warn(`${indexLabel} 跳过: ${displayName}（状态: ${skill.status}）`);
        results.push({ success: false, name: displayName, error: `不可同步的状态: ${skill.status}` });
      }

    } catch (err) {
      spinner.stop();
      const message = err.response?.data?.error?.message || err.message;
      logger.error(`${indexLabel} 同步失败: ${displayName} - ${message}`);
      results.push({ success: false, name: displayName, error: message });
    }
  }

  return results;
}

/**
 * 推送新增资源：调用 POST /api/resources 创建
 *
 * 与 publish.js / import.js 的上传逻辑一致：
 * 构建 FormData，包含 name / display_name / type / description / platforms / files。
 *
 * @param {object} skill - local-state 中的资源记录
 * @returns {Promise<object>} 服务器返回的资源数据 { id, current_version, ... }
 */
async function pushNewResource(skill) {
  const formData = new FormData();
  formData.append('name', skill.name);
  formData.append('display_name', skill.display_name || skill.name);
  formData.append('type', skill.type);
  formData.append('description', `从 ${skill.platform} 同步导入`);
  formData.append('platforms', JSON.stringify([skill.platform]));

  // 读取本地文件并附加到 FormData
  const filePaths = skill.file_paths || [];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    formData.append('files', content, filename);
  }

  const result = await api.publishResource(formData);
  return result.data;
}

/**
 * 推送更新资源：调用 POST /api/resources/:id/versions 添加新版本
 *
 * 自动计算版本号：基于远端当前版本递增 patch 版本。
 * 如果远端版本不是 semver 格式（如 "1"），则直接 +1。
 *
 * @param {object} skill - local-state 中的资源记录，含 remote_id / remote_version
 * @returns {Promise<object>} 服务器返回的资源数据 { current_version, ... }
 */
async function pushUpdatedResource(skill) {
  // 构建新版本号
  const nextVersion = incrementVersion(skill.remote_version);

  const formData = new FormData();
  formData.append('version', nextVersion);
  formData.append('changelog', `从 ${skill.platform} 同步更新`);

  // 读取本地文件并附加到 FormData
  const filePaths = skill.file_paths || [];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    formData.append('files', content, filename);
  }

  const resourceId = skill.remote_id;
  const result = await api.addVersion(resourceId, formData);
  return result.data;
}

/**
 * 版本号递增：patch 级别 +1
 *
 * 支持两种格式：
 *   - semver 格式 (1.2.3) → 1.2.4
 *   - 简单数字 (1) → 2
 *   - null / undefined → 1.0.1
 *
 * @param {string|null} currentVersion - 当前版本号
 * @returns {string} 递增后的版本号
 */
function incrementVersion(currentVersion) {
  if (!currentVersion) return '1.0.1';

  // 尝试 semver 解析
  const semverMatch = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (semverMatch) {
    const major = parseInt(semverMatch[1], 10);
    const minor = parseInt(semverMatch[2], 10);
    const patch = parseInt(semverMatch[3], 10);
    return `${major}.${minor}.${patch + 1}`;
  }

  // 简单数字格式
  const simpleNum = parseInt(currentVersion, 10);
  if (!isNaN(simpleNum)) {
    return String(simpleNum + 1);
  }

  // 无法解析，加 .1 后缀
  return `${currentVersion}.1`;
}

// ──────────────────────────── 命令入口 ────────────────────────────

/**
 * sync 命令入口
 *
 * @param {object} options - 命令行选项
 * @param {boolean} [options.auto] - 跳过交互，自动同步 new + updated
 * @param {string} [options.platform] - 限定平台
 * @param {string} [options.type] - 限定资源类型
 * @param {boolean} [options.dryRun] - 只显示不实际推送
 * @param {string} [options.web] - Web 协作模式 session_id
 */
async function syncCommand(options) {
  const resolvedPlatform = resolvePlatform(options.platform);
  const { auto, type, dryRun, web } = options;

  // ── Web 协作模式 ──
  if (web) {
    await syncWithWeb({ platform: resolvedPlatform, type, dryRun, sessionId: web });
    return;
  }

  // ── 常规模式 ──

  // Phase 1: 扫描 + 指纹 + 比对
  const skills = await phaseScan({ platform: resolvedPlatform, type });
  if (skills.length === 0) return;

  // 展示扫描结果表格
  console.log('');
  logger.title('本地资源状态');
  for (const skill of skills) {
    const icon = STATUS_ICONS[skill.status] || STATUS_ICONS.local;
    const label = STATUS_LABELS[skill.status] || '未知';
    const displayName = skill.display_name || skill.name;
    const fileCount = (skill.file_paths || []).length;
    const hashShort = skill.content_hash ? skill.content_hash.slice(0, 8) : '(无)';
    console.log(`  ${icon} ${displayName}  [${skill.platform}/${skill.type}]  ${label}  文件数:${fileCount}  指纹:${hashShort}`);
  }
  console.log('');

  // Phase 2: 选择同步资源
  const selected = await phaseSelect(skills, { auto });
  if (selected.length === 0) return;

  // Phase 3: 推送
  const results = await phasePush(selected, { dryRun });

  // 输出结果摘要
  if (!dryRun) {
    console.log('');
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logger.title('同步完成');
    logger.success(`成功: ${successCount} 个`);

    if (failCount > 0) {
      logger.error(`失败: ${failCount} 个`);
      const failed = results.filter(r => !r.success);
      for (const f of failed) {
        logger.error(`  - ${f.name}: ${f.error}`);
      }
    }

    logger.info('提示：使用 skhub list 查看注册中心的资源列表');
  } else {
    console.log('');
    logger.info('以上为 --dry-run 模式预览，移除 --dry-run 参数以执行实际同步');
  }
}

// ──────────────────────────── Web 协作模式 ────────────────────────────

/**
 * Web 协作模式完整流程
 *
 * Phase 1 (scan): 扫描本地资源 + POST scan 结果到 server
 * Phase 2 (select): 输出 session_id 提示 → 轮询等待 Web 的 push_plan
 * Phase 3 (push): 按 push_plan 推送，每完成一个就 POST 增量结果
 *
 * @param {object} options - 命令行选项
 * @param {string} [options.platform] - 限定平台
 * @param {string} [options.type] - 限定资源类型
 * @param {boolean} [options.dryRun] - 只显示不实际推送
 * @param {string} options.sessionId - Web 协作模式的 session_id
 */
async function syncWithWeb(options) {
  const { platform, type, dryRun, sessionId } = options;

  // ── Phase 1: 扫描 + POST scan 结果 ──

  const skills = await phaseScan({ platform, type });
  if (skills.length === 0) {
    // 即使没有资源，也通知 server
    try {
      await webSync.postScanResult(sessionId, []);
    } catch (err) {
      logger.warn(`上传空扫描结果失败: ${err.message}`);
    }
    return;
  }

  // 展示扫描结果表格
  console.log('');
  logger.title('本地资源状态');
  for (const skill of skills) {
    const icon = STATUS_ICONS[skill.status] || STATUS_ICONS.local;
    const label = STATUS_LABELS[skill.status] || '未知';
    const displayName = skill.display_name || skill.name;
    const fileCount = (skill.file_paths || []).length;
    const hashShort = skill.content_hash ? skill.content_hash.slice(0, 8) : '(无)';
    console.log(`  ${icon} ${displayName}  [${skill.platform}/${skill.type}]  ${label}  文件数:${fileCount}  指纹:${hashShort}`);
  }
  console.log('');

  // POST scan 结果到 server
  const scanSpinner = logger.spinner('正在上传扫描结果到 Web...');
  try {
    await webSync.postScanResult(sessionId, skills);
    scanSpinner.stop();
    logger.success('扫描结果已上传到 Web');
  } catch (err) {
    scanSpinner.stop();
    logger.error(`上传扫描结果失败: ${err.message}`);
    logger.warn('将退回到常规交互模式');

    // 退回到常规模式
    const selected = await phaseSelect(skills, { auto: false });
    if (selected.length === 0) return;
    const results = await phasePush(selected, { dryRun });
    outputResults(results, dryRun);
    return;
  }

  // ── Phase 2: 等待 Web 端选择 ──

  console.log('');
  logger.info(`💡 请在浏览器中查看扫描结果并选择要推送的资源 (Session: ${sessionId})`);
  logger.info('Web 页面地址: ' + api.getConfig().hubUrl + '/sync/' + sessionId);
  console.log('');

  logger.info('等待 Web 端选择推送计划...');
  const pushPlan = await webSync.waitForPushPlan(sessionId);

  if (pushPlan.length === 0) {
    logger.warn('未收到推送计划或已取消，同步结束');
    return;
  }

  // ── Phase 3: 按 push_plan 推送 + 增量上报 ──

  // 将 push_plan 中的名称映射到本地完整 skill 记录
  const skillMap = new Map(skills.map(s => [s.name, s]));
  const selectedSkills = [];

  for (const planItem of pushPlan) {
    const skillName = planItem.name;
    const localSkill = skillMap.get(skillName);

    if (!localSkill) {
      logger.warn(`推送计划中的 ${skillName} 在本地未找到，跳过`);
      continue;
    }

    // 使用 push_plan 中指定的 status（Web 可能调整了状态）
    if (planItem.status) {
      localSkill._planStatus = planItem.status;
    }
    selectedSkills.push(localSkill);
  }

  if (selectedSkills.length === 0) {
    logger.warn('推送计划中的资源在本地均未找到，同步结束');
    return;
  }

  logger.title(`开始推送 ${selectedSkills.length} 个资源...`);

  const pushPlanTotal = selectedSkills.length;
  const pushResults = [];

  for (let i = 0; i < selectedSkills.length; i++) {
    const skill = selectedSkills[i];
    const displayName = skill.display_name || skill.name;
    const indexLabel = `[${i + 1}/${selectedSkills.length}]`;

    if (dryRun) {
      const icon = STATUS_ICONS[skill._planStatus || skill.status];
      const action = (skill._planStatus || skill.status) === 'new' ? '创建新资源' : '添加新版本';
      logger.info(`${indexLabel} ${icon} ${displayName} — ${action}`);
      const singleResult = { success: true, name: displayName, action, dryRun: true };
      pushResults.push(singleResult);
      continue;
    }

    const spinner = logger.spinner(`${indexLabel} 正在同步: ${displayName}`);

    try {
      // 使用 push_plan 中指定的状态（如果有）或本地状态
      const effectiveStatus = skill._planStatus || skill.status;
      let result;

      if (effectiveStatus === 'new') {
        result = await pushNewResource(skill);
        spinner.stop();

        localState.updateRemoteInfo(
          skill.name,
          skill.content_hash,
          result.id,
          result.current_version,
          'synced'
        );

        logger.success(`${indexLabel} 创建成功: ${displayName} (v${result.current_version})`);
        pushResults.push({ success: true, name: displayName, action: '创建新资源', id: result.id });

      } else if (effectiveStatus === 'updated') {
        result = await pushUpdatedResource(skill);
        spinner.stop();

        localState.updateRemoteInfo(
          skill.name,
          skill.content_hash,
          skill.remote_id,
          result.current_version,
          'synced'
        );

        logger.success(`${indexLabel} 更新成功: ${displayName} → v${result.current_version}`);
        pushResults.push({ success: true, name: displayName, action: '添加新版本', id: skill.remote_id });

      } else {
        spinner.stop();
        logger.warn(`${indexLabel} 跳过: ${displayName}（状态: ${effectiveStatus}）`);
        pushResults.push({ success: false, name: displayName, error: `不可同步的状态: ${effectiveStatus}` });
      }

    } catch (err) {
      spinner.stop();
      const message = err.response?.data?.error?.message || err.message;
      logger.error(`${indexLabel} 同步失败: ${displayName} - ${message}`);
      pushResults.push({ success: false, name: displayName, error: message });
    }

    // 增量上报：每推送完一个就 POST 结果到 server
    if (!dryRun) {
      const latestResult = pushResults[pushResults.length - 1];
      try {
        await webSync.postIncrementalResult(sessionId, latestResult, pushResults, pushPlanTotal);
      } catch (err) {
        // 增量上报失败不影响推送流程，只打印警告
        logger.warn(`增量上报失败: ${err.message}`);
      }
    }
  }

  // 最终汇总上报
  if (!dryRun) {
    try {
      await webSync.postPushResult(sessionId, pushResults, pushPlan);
    } catch (err) {
      logger.warn(`最终汇总上报失败: ${err.message}`);
    }
  }

  // 输出结果摘要
  outputResults(pushResults, dryRun);
}

/**
 * 输出推送结果摘要（常规模式和 Web 协作模式共用）
 *
 * @param {object[]} results - 推送结果数组
 * @param {boolean} dryRun - 是否为 dry-run 模式
 */
function outputResults(results, dryRun) {
  if (!dryRun) {
    console.log('');
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logger.title('同步完成');
    logger.success(`成功: ${successCount} 个`);

    if (failCount > 0) {
      logger.error(`失败: ${failCount} 个`);
      const failed = results.filter(r => !r.success);
      for (const f of failed) {
        logger.error(`  - ${f.name}: ${f.error}`);
      }
    }

    logger.info('提示：使用 skhub list 查看注册中心的资源列表');
  } else {
    console.log('');
    logger.info('以上为 --dry-run 模式预览，移除 --dry-run 参数以执行实际同步');
  }
}

module.exports = syncCommand;