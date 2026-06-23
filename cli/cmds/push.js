/**
 * push 命令
 * 智能上传/更新本地资源到 SkillHub 远程服务器
 *
 * 工作流程：
 *   1. 从 local-state 读取同步状态（new / updated）
 *   2. new 资源 → POST /api/resources（FormData：name, display_name, type, description, platforms, tags, files）
 *   3. updated 资源 → POST /api/resources/:id/versions（FormData：version, changelog, files）
 *   4. 成功后调用 local-state.updateRemoteInfo() 更新本地记录
 *
 * 选项：
 *   [name]        指定单个资源名称
 *   --all         推送所有 new + updated 资源
 *   --new         仅推送 new 资源
 *   --update      仅推送 updated 资源
 *   --dry-run     只列出待推送的资源，不实际执行
 */

const logger = require('../utils/logger');
const api = require('../api-client');
const localState = require('../utils/local-state');
const { computeCollectionHash } = require('../utils/fingerprint');
const { bundleExpert } = require('../utils/expert-bundler');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const semver = require('semver');
const inquirer = require('inquirer').default || require('inquirer');

/**
 * 向 FormData 追加文件（Expert 智能打包）
 *
 * Expert 类型自动调用 bundleExpert 构建 ZIP；其他类型直接上传原始文件。
 *
 * @param {FormData} formData - 表单数据
 * @param {object} skill - local-state 记录（含 file_paths, type, name）
 * @returns {{ bundled: boolean, found: number, missing: number } | null}
 */
function appendFilesToForm(formData, skill) {
  const filePaths = skill.file_paths || [];

  if (skill.type === 'expert' && filePaths.length > 0) {
    const result = bundleExpert(filePaths[0], { type: 'expert' });
    if (result.isExpert && result.zipBuffer) {
      formData.append('files', result.zipBuffer, `${skill.name}.zip`);
      return {
        bundled: true,
        found: result.foundSkills.length,
        missing: result.missingSkills.length,
        structureLength: result.structure.length,
      };
    }
  }

  // 普通类型 或 Expert 打包失败 → 直接上传文件
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    formData.append('files', content, filename);
  }
  return null;
}

/**
 * 推送一个 new 资源（首次上传）
 *
 * 构建 FormData 调用 POST /api/resources，上传后更新 local-state 记录。
 *
 * @param {object} skill - local-state 中的 skill 记录
 * @param {number} index - 当前序号
 * @param {number} total - 总数
 * @returns {Promise<{success: boolean, name: string, error?: string}>}
 */
async function pushNew(skill, index, total) {
  const spinner = logger.spinner(`[${index}/${total}] 正在上传新资源: ${skill.display_name || skill.name}`);

  try {
    const formData = new FormData();
    formData.append('name', skill.name);
    formData.append('display_name', skill.display_name || skill.name);
    formData.append('type', skill.type);
    formData.append('description', `从 ${skill.platform} 推送`);
    formData.append('platforms', JSON.stringify([skill.platform]));
    formData.append('tags', JSON.stringify([]));

    // 添加文件（Expert 智能打包）
    const bundleInfo = appendFilesToForm(formData, skill);
    if (bundleInfo) {
      spinner.stop();
      logger.info(`   📦 Expert 打包: ${bundleInfo.structureLength} 个文件` +
        (bundleInfo.found > 0 ? `, 包含 ${bundleInfo.found} 个 Skill` : '') +
        (bundleInfo.missing > 0 ? `, ⚠ ${bundleInfo.missing} 个 Skill 未找到` : ''));
    }

    const response = await api.publishResource(formData);
    const resource = response.data;

    // 更新本地状态：记录远程 ID 和版本（使用复合主键精确匹配）
    localState.updateRemoteInfo(
      skill.name,
      skill.content_hash,  // remote_hash = 当前本地哈希（刚推送，完全一致）
      resource.id,          // remote_id
      resource.current_version, // remote_version
      'synced',             // 状态变为 synced
      skill.platform,       // platform 精确匹配
      skill.type            // type 精确匹配
    );

    spinner.stop();
    logger.success(`[${index}/${total}] 上传成功: ${skill.display_name || skill.name}`);
    logger.info(`   ID: ${resource.id} | 版本: v${resource.current_version}`);
    return { success: true, name: skill.display_name || skill.name };

  } catch (err) {
    spinner.stop();
    const message = err.response?.data?.error?.message || err.message;
    logger.error(`[${index}/${total}] 上传失败: ${skill.display_name || skill.name} - ${message}`);
    return { success: false, name: skill.display_name || skill.name, error: message };
  }
}

/**
 * 推送一个 updated 资源（版本更新）
 *
 * 自动计算 patch 版本号，生成 changelog，调用 POST /api/resources/:id/versions。
 *
 * @param {object} skill - local-state 中的 skill 记录（必须有 remote_id 和 remote_version）
 * @param {number} index - 当前序号
 * @param {number} total - 总数
 * @returns {Promise<{success: boolean, name: string, error?: string}>}
 */
async function pushUpdate(skill, index, total) {
  const spinner = logger.spinner(`[${index}/${total}] 正在更新资源: ${skill.display_name || skill.name}`);

  try {
    // 自动计算 patch 版本号
    const currentVersion = skill.remote_version || '1.0.0';
    const newVersion = semver.inc(currentVersion, 'patch') || `${currentVersion}.1`;

    // 自动生成 changelog：列出变更文件数
    const filePaths = skill.file_paths || [];
    const changelog = `更新 ${filePaths.length} 个文件`;

    const formData = new FormData();
    formData.append('version', newVersion);
    formData.append('changelog', changelog);

    // 添加更新的文件（Expert 智能打包）
    appendFilesToForm(formData, skill);

    const response = await api.addVersion(skill.remote_id, formData);
    const resource = response.data;

    // 计算当前推送后的内容哈希
    const collectionHash = computeCollectionHash(filePaths.filter(f => fs.existsSync(f)));

    // 更新本地状态（使用复合主键精确匹配）
    localState.updateRemoteInfo(
      skill.name,
      collectionHash,        // remote_hash = 推送后的哈希
      resource.id,           // remote_id
      resource.current_version, // remote_version = 新版本号
      'synced',              // 状态回到 synced
      skill.platform,        // platform 精确匹配
      skill.type             // type 精确匹配
    );

    spinner.stop();
    logger.success(`[${index}/${total}] 更新成功: ${skill.display_name || skill.name}`);
    logger.info(`   版本: v${currentVersion} → v${resource.current_version}`);
    return { success: true, name: skill.display_name || skill.name };

  } catch (err) {
    spinner.stop();
    const message = err.response?.data?.error?.message || err.message;
    logger.error(`[${index}/${total}] 更新失败: ${skill.display_name || skill.name} - ${message}`);
    return { success: false, name: skill.display_name || skill.name, error: message };
  }
}

/**
 * push 命令入口
 *
 * @param {string} [name] - 指定单个资源名称（可选）
 * @param {object} options - 命令行选项
 * @param {boolean} [options.all]     - 推送所有 new + updated 资源
 * @param {boolean} [options.new]     - 仅推送 new 资源
 * @param {boolean} [options.update]  - 仅推送 updated 资源
 * @param {boolean} [options.dryRun]  - 只列出待推送的资源，不实际执行
 */
async function pushCommand(name, options) {
  const { all, new: onlyNew, update: onlyUpdate, dryRun } = options;

  // 1. 从 local-state 获取待推送资源
  let newSkills = localState.getSkillsByStatus('new');
  let updatedSkills = localState.getSkillsByStatus('updated');
  // local 状态的资源视为 new（尚未与远端比对）
  let localSkills = localState.getSkillsByStatus('local');

  // 合并 local 状态到 new（未比对过的视为新资源）
  const pendingNew = [...newSkills, ...localSkills];
  const pendingUpdate = updatedSkills;

  // 2. 根据选项筛选
  let pushNewList = [];
  let pushUpdateList = [];

  if (onlyNew) {
    pushNewList = pendingNew;
    pushUpdateList = [];
  } else if (onlyUpdate) {
    pushNewList = [];
    pushUpdateList = pendingUpdate;
  } else if (all) {
    pushNewList = pendingNew;
    pushUpdateList = pendingUpdate;
  } else if (name) {
    // 指定单个资源名称
    const nameNew = pendingNew.filter(s => s.name === name);
    const nameUpdate = pendingUpdate.filter(s => s.name === name);

    if (nameNew.length === 0 && nameUpdate.length === 0) {
      logger.error(`未找到名为 "${name}" 的待推送资源`);
      logger.info('提示：使用 skhub scan 先扫描本地资源');
      process.exit(1);
    }

    pushNewList = nameNew;
    pushUpdateList = nameUpdate;
  } else {
    // 无选项无名称：交互式选择
    if (pendingNew.length === 0 && pendingUpdate.length === 0) {
      logger.warn('没有待推送的资源');
      logger.info('提示：使用 skhub scan 先扫描本地资源');
      return;
    }

    // 构建选择列表
    const choices = [];

    for (const s of pendingNew) {
      choices.push({
        name: `[新增] ${s.platform}/${s.type}: ${s.display_name || s.name} (${s.file_paths?.length || 0} 个文件)`,
        value: { category: 'new', skill: s },
        checked: true,
      });
    }

    for (const s of pendingUpdate) {
      choices.push({
        name: `[更新] ${s.platform}/${s.type}: ${s.display_name || s.name} (v${s.remote_version} → patch)`,
        value: { category: 'update', skill: s },
        checked: true,
      });
    }

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: '请选择要推送的资源 (空格勾选，回车确认):',
        choices,
        pageSize: 15,
      },
    ]);

    if (answers.selected.length === 0) {
      logger.warn('未选择任何资源，已取消推送');
      return;
    }

    pushNewList = answers.selected.filter(s => s.category === 'new').map(s => s.skill);
    pushUpdateList = answers.selected.filter(s => s.category === 'update').map(s => s.skill);
  }

  // 3. 列出待推送资源
  const totalNew = pushNewList.length;
  const totalUpdate = pushUpdateList.length;
  const total = totalNew + totalUpdate;

  if (total === 0) {
    logger.warn('没有符合条件的待推送资源');
    return;
  }

  console.log('');
  logger.title('待推送资源');

  if (totalNew > 0) {
    logger.info(`新增 (${totalNew} 个):`);
    pushNewList.forEach((s, i) => {
      logger.info(`  ${i + 1}. [${s.platform}/${s.type}] ${s.display_name || s.name} (${s.file_paths?.length || 0} 个文件)`);
    });
  }

  if (totalUpdate > 0) {
    logger.info(`更新 (${totalUpdate} 个):`);
    pushUpdateList.forEach((s, i) => {
      logger.info(`  ${i + 1}. [${s.platform}/${s.type}] ${s.display_name || s.name} (v${s.remote_version} → patch)`);
    });
  }

  console.log('');

  // 4. --dry-run 模式：只列出，不执行
  if (dryRun) {
    logger.info('--dry-run 模式，未实际推送。移除 --dry-run 参数以执行推送。');
    return;
  }

  // 5. 逐个推送
  logger.title('开始推送...');

  const results = [];
  let index = 0;

  for (const skill of pushNewList) {
    index++;
    const result = await pushNew(skill, index, total);
    results.push(result);
  }

  for (const skill of pushUpdateList) {
    index++;
    const result = await pushUpdate(skill, index, total);
    results.push(result);
  }

  // 6. 输出推送结果摘要
  console.log('');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  logger.title('推送完成');
  logger.success(`成功: ${successCount} 个`);

  if (failCount > 0) {
    logger.error(`失败: ${failCount} 个`);
    const failed = results.filter(r => !r.success);
    for (const f of failed) {
      logger.error(`  - ${f.name}: ${f.error}`);
    }
  }

  logger.info('提示：使用 skhub list 查看远程资源列表');
}

module.exports = pushCommand;