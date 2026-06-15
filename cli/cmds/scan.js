/**
 * scan 命令
 * 扫描本地 AI 配置文件，生成指纹，与远端注册中心比对后输出状态报告
 */

const logger = require('../utils/logger');
const api = require('../api-client');
const { scanAll, resolvePlatform } = require('../utils/scanner');
const { generateFingerprint } = require('../utils/fingerprint');
const localState = require('../utils/local-state');

/**
 * 将远端指纹映射按本地资源的 name 字段匹配，构建比对结果
 *
 * 远端 API 返回: { name: { hash, id, version, type } }
 * 本地指纹 id 格式: platform:type:name
 * 比对策略：按本地资源的 name 字段在远端映射中查找同名资源，
 *           同时检查 type 是否匹配，避免不同类型同名资源的误判。
 *
 * @param {object[]} localFingerprints - 本地指纹数据数组
 * @param {object} remoteMap - 远端指纹映射 { name: { hash, id, version, type } }
 * @returns {{ synced: object[], updated: object[], new: object[] }}
 */
function compareWithRemote(localFingerprints, remoteMap) {
  const synced = [];
  const updated = [];
  const newResources = [];

  for (const fp of localFingerprints) {
    const remote = remoteMap[fp.name];

    if (!remote) {
      // 远端不存在同名资源 → new
      newResources.push({
        fingerprint: fp,
        remoteInfo: null,
      });
    } else if (fp.type !== remote.type) {
      // 同名但类型不同 → 视为 new（不同类型不可比较）
      newResources.push({
        fingerprint: fp,
        remoteInfo: null,
      });
    } else if (fp.collectionHash === remote.hash) {
      // 指纹一致 → synced
      synced.push({
        fingerprint: fp,
        remoteInfo: remote,
      });
    } else {
      // 指纹不一致 → updated（本地有变更）
      updated.push({
        fingerprint: fp,
        remoteInfo: remote,
      });
    }
  }

  return { synced, updated, new: newResources };
}

/**
 * 输出分组状态报告
 *
 * 按 new / updated / synced 三组分别输出，每组显示资源列表。
 * --json 模式下输出结构化 JSON。
 *
 * @param {object} groups - 比对结果分组 { synced, updated, new }
 * @param {boolean} jsonMode - 是否输出 JSON 格式
 */
function outputReport(groups, jsonMode) {
  const { synced, updated, new: newResources } = groups;

  if (jsonMode) {
    const report = {
      total: synced.length + updated.length + newResources.length,
      new: newResources.map(item => ({
        id: item.fingerprint.id,
        name: item.fingerprint.name,
        displayName: item.fingerprint.displayName,
        platform: item.fingerprint.platform,
        type: item.fingerprint.type,
        collectionHash: item.fingerprint.collectionHash,
      })),
      updated: updated.map(item => ({
        id: item.fingerprint.id,
        name: item.fingerprint.name,
        displayName: item.fingerprint.displayName,
        platform: item.fingerprint.platform,
        type: item.fingerprint.type,
        localHash: item.fingerprint.collectionHash,
        remoteHash: item.remoteInfo.hash,
        remoteId: item.remoteInfo.id,
        remoteVersion: item.remoteInfo.version,
      })),
      synced: synced.map(item => ({
        id: item.fingerprint.id,
        name: item.fingerprint.name,
        displayName: item.fingerprint.displayName,
        platform: item.fingerprint.platform,
        type: item.fingerprint.type,
        collectionHash: item.fingerprint.collectionHash,
        remoteId: item.remoteInfo.id,
        remoteVersion: item.remoteInfo.version,
      })),
    };
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const total = synced.length + updated.length + newResources.length;

  logger.title('扫描报告');
  logger.info(`共发现 ${total} 个本地资源`);

  // new 分组
  if (newResources.length > 0) {
    console.log('');
    logger.warn(`新增 (new): ${newResources.length} 个 — 远端注册中心不存在`);
    for (const item of newResources) {
      const fp = item.fingerprint;
      console.log(`  ${fp.displayName}  [${fp.platform}/${fp.type}]`);
    }
  }

  // updated 分组
  if (updated.length > 0) {
    console.log('');
    logger.error(`已变更 (updated): ${updated.length} 个 — 本地内容与远端不一致`);
    for (const item of updated) {
      const fp = item.fingerprint;
      console.log(`  ${fp.displayName}  [${fp.platform}/${fp.type}]  (远端版本: ${item.remoteInfo.version})`);
    }
  }

  // synced 分组
  if (synced.length > 0) {
    console.log('');
    logger.success(`已同步 (synced): ${synced.length} 个 — 本地与远端一致`);
    for (const item of synced) {
      const fp = item.fingerprint;
      console.log(`  ${fp.displayName}  [${fp.platform}/${fp.type}]  (远端版本: ${item.remoteInfo.version})`);
    }
  }

  // 空结果提示
  if (total === 0) {
    console.log('');
    logger.warn('未发现任何本地资源');
    logger.info('提示：请确保相关 AI 平台的配置文件存在于 HOME 目录下');
  }

  // 汇总提示
  if (newResources.length > 0 || updated.length > 0) {
    console.log('');
    logger.info('提示：使用 skhub push 上传新 Skill，使用 skhub push --update 推送更新');
  }
}

/**
 * scan 命令入口
 *
 * 流程：
 *   1. scanAll({type}) 从 scanner.js 扫描本地资源
 *   2. generateFingerprint() 为每个资源生成指纹
 *   3. upsertSkill() 将指纹写入本地状态数据库
 *   4. api.getFingerprintMap() 获取远端指纹映射
 *   5. compareWithRemote() 比对本地与远端指纹
 *   6. 输出状态报告（按 new/synced/updated 分组）
 *
 * @param {object} options - 命令行选项
 * @param {string} [options.platform] - 限定平台 (claude-code|cursor|workbuddy)
 * @param {string} [options.type] - 限定资源类型 (skill|expert)
 * @param {boolean} [options.json] - 以 JSON 格式输出
 * @param {boolean} [options.dryRun] - 只输出报告，不写入本地状态数据库
 */
async function scanCommand(options) {
  const resolvedPlatform = resolvePlatform(options.platform);
  const { type, json, dryRun } = options;

  // 1. 扫描本地资源
  const spinner = logger.spinner('正在扫描本地 AI 配置文件...');
  let items;
  try {
    items = scanAll({ platform: resolvedPlatform, type });
  } catch (err) {
    spinner.stop();
    logger.error(`扫描失败: ${err.message}`);
    process.exit(1);
  }
  spinner.stop();

  if (items.length === 0) {
    const filterStr = [];
    if (resolvedPlatform) filterStr.push(`平台: ${resolvedPlatform}`);
    if (type) filterStr.push(`类型: ${type}`);
    const hint = filterStr.length > 0 ? `（筛选条件: ${filterStr.join(', ')}）` : '';
    outputReport({ synced: [], updated: [], new: [] }, json);
    logger.warn(`未发现本地配置${hint}`);
    return;
  }

  if (!json) {
    logger.success(`发现 ${items.length} 个本地资源`);
  }

  // 2. 生成指纹
  const fingerprints = items.map(item => generateFingerprint(item));

  // 3. 写入本地状态（非 --dry-run 时）
  if (!dryRun) {
    for (const fp of fingerprints) {
      localState.upsertSkill({
        name: fp.name,
        type: fp.type,
        platform: fp.platform,
        display_name: fp.displayName,
        content_hash: fp.collectionHash,
        file_paths: Object.keys(fp.fileHashes),
        status: 'local',
      });
    }
  }

  // 4. 获取远端指纹映射
  let remoteMap = {};
  try {
    const result = await api.getFingerprintMap();
    remoteMap = result.data || {};
  } catch (err) {
    if (!json) {
      logger.warn(`获取远端指纹失败: ${err.message}`);
      logger.info('将仅输出本地扫描结果，无法比对远端状态');
    }
  }

  // 5. 比对本地与远端指纹
  const groups = compareWithRemote(fingerprints, remoteMap);

  // 6. 更新本地状态中的远端信息（非 --dry-run 时）
  if (!dryRun) {
    for (const item of groups.synced) {
      localState.updateRemoteInfo(
        item.fingerprint.name,
        item.remoteInfo.hash,
        item.remoteInfo.id,
        item.remoteInfo.version,
        'synced'
      );
    }
    for (const item of groups.updated) {
      localState.updateRemoteInfo(
        item.fingerprint.name,
        item.remoteInfo.hash,
        item.remoteInfo.id,
        item.remoteInfo.version,
        'updated'
      );
    }
    for (const item of groups.new) {
      localState.updateRemoteInfo(
        item.fingerprint.name,
        null,
        null,
        null,
        'new'
      );
    }
  }

  // --dry-run 提示
  if (dryRun && !json) {
    console.log('');
    logger.info('--dry-run 模式，未写入本地状态数据库。移除 --dry-run 参数以持久化扫描结果。');
  }

  // 7. 输出状态报告
  outputReport(groups, json);
}

module.exports = scanCommand;