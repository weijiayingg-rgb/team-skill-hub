/**
 * WorkBuddy → SkillHub 迁移脚本：产品管理专家
 *
 * 从 WorkBuddy 的 product-management 插件读取全部文件，
 * 写入 SkillHub 的 Git Registry + SQLite 数据库。
 *
 * 用法：node scripts/migrate-workbuddy-pm.js
 */

const path = require('path');
const fs = require('fs');

// ── 设置环境变量（必须在 require model 之前） ──
process.env.DB_PATH = path.join(__dirname, '..', 'server', 'data', 'skillhub.db');
process.env.REGISTRY_PATH = path.join(__dirname, '..', 'server', 'data', 'skillhub-registry');

// ── 引入 SkillHub 服务层 ──
const { getDb } = require('../server/models/db');
const resourceModel = require('../server/models/resources');
const tagModel = require('../server/models/tags');
const gitStore = require('../server/services/git-store');
const manifestGenerator = require('../server/services/manifest-generator');

// ── 配置 ──
const RESOURCE_NAME = 'product-management-expert';
const DISPLAY_NAME = '产品管理专家';
const TYPE = 'expert';
const VERSION = '1.0.0';
const AUTHOR_ID = 1; // zhangsan
const PLATFORMS = ['workbuddy', 'cursor', 'claude-code'];
const TAGS = ['产品管理', 'PRD', '路线图', '竞品分析', '用户研究', '指标追踪', 'OKR'];
const CHANGELOG = '从 WorkBuddy 迁移，覆盖 PM 全生命周期 9 大能力模块';
const DESCRIPTION = [
  '产品管理工具集：功能规格编写、路线图规划、利益相关者沟通、',
  '用户研究综合、竞品分析和指标追踪。覆盖从构思到上线的完整',
  '产品生命周期，包含 PRD 编写、RICE/MoSCoW/ICE 优先级框架、',
  'OKR 目标设定、用户画像开发、竞品对比矩阵等专业方法论。',
].join('');

// WorkBuddy 插件源路径
const WB_PLUGIN_DIR = path.join(
  process.env.HOME,
  '.workbuddy/plugins/marketplaces/cb_teams_marketplace/plugins/product-management'
);

// 文件映射表：[源路径, 目标文件名]
const FILE_MAP = [
  ['README.md',                                         'README.md'],
  ['rules/product_management_rules.md',                 'product_management_rules.md'],
  ['skills/product-management-workflows/SKILL.md',      'product-management-workflows.md'],
  ['skills/feature-spec/SKILL.md',                      'feature-spec.md'],
  ['skills/roadmap-management/SKILL.md',                'roadmap-management.md'],
  ['skills/stakeholder-comms/SKILL.md',                 'stakeholder-comms.md'],
  ['skills/user-research-synthesis/SKILL.md',           'user-research-synthesis.md'],
  ['skills/competitive-analysis/SKILL.md',              'competitive-analysis.md'],
  ['skills/metrics-tracking/SKILL.md',                  'metrics-tracking.md'],
  ['skills/product-brainstorming/SKILL.md',             'product-brainstorming.md'],
  ['skills/sprint-planning/SKILL.md',                   'sprint-planning.md'],
];

async function migrate() {
  console.log('🚀 WorkBuddy → SkillHub 迁移：产品管理专家\n');

  // ── 1. 检查源文件 ──
  console.log('📂 检查源文件...');
  if (!fs.existsSync(WB_PLUGIN_DIR)) {
    console.error(`❌ 源目录不存在: ${WB_PLUGIN_DIR}`);
    process.exit(1);
  }

  const files = [];
  for (const [srcPath, destName] of FILE_MAP) {
    const fullPath = path.join(WB_PLUGIN_DIR, srcPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ 源文件缺失: ${fullPath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    files.push({ name: destName, content });
    console.log(`   ✅ ${srcPath} (${content.length} bytes)`);
  }
  console.log(`   共 ${files.length} 个文件\n`);

  // ── 2. 检查是否已存在 ──
  const existing = resourceModel.findByName(RESOURCE_NAME);
  if (existing) {
    console.log(`⚠️  资源已存在: ${RESOURCE_NAME} (id=${existing.id})，跳过创建`);
    console.log('   如需重新迁移，请先删除旧记录');
    return;
  }

  // ── 3. 写入 Git Registry ──
  console.log('📦 写入 Git Registry...');
  await gitStore.ensureResourceDir(RESOURCE_NAME, VERSION);

  for (const file of files) {
    await gitStore.writeResourceFile(RESOURCE_NAME, VERSION, file.name, file.content);
    console.log(`   ✅ ${file.name}`);
  }

  // 写入 metadata.yaml
  const metadataYaml = {
    name: RESOURCE_NAME,
    display_name: DISPLAY_NAME,
    type: TYPE,
    description: DESCRIPTION,
    author: 'zhangsan',
    tags: TAGS,
    platforms: PLATFORMS,
    source: 'WorkBuddy',
    versions: [{
      version: VERSION,
      date: new Date().toISOString().split('T')[0],
      changelog: CHANGELOG,
      entry_file: 'README.md',
    }],
  };
  await gitStore.writeMetadata(RESOURCE_NAME, metadataYaml);
  console.log('   ✅ metadata.yaml');

  await gitStore.commitAndPush(`feat: migrate product-management-expert from WorkBuddy`);
  console.log('   ✅ Git commit 完成\n');

  // ── 4. 写入数据库 ──
  console.log('💾 写入数据库...');
  const gitPath = `resources/${RESOURCE_NAME}/v${VERSION}`;
  const resource = resourceModel.create({
    name: RESOURCE_NAME,
    display_name: DISPLAY_NAME,
    type: TYPE,
    description: DESCRIPTION,
    author_id: AUTHOR_ID,
    current_version: VERSION,
    tags: TAGS,
    status: 'published',
    git_path: gitPath,
  });
  console.log(`   ✅ resources 表: id=${resource.id}`);

  // 设置 platforms（model 层不支持，需直接 SQL）
  const db = getDb();
  db.prepare(`UPDATE resources SET platforms = ? WHERE id = ?`)
    .run(JSON.stringify(PLATFORMS), resource.id);
  console.log(`   ✅ platforms: ${JSON.stringify(PLATFORMS)}`);

  // 设置标签关联
  if (TAGS.length > 0) {
    tagModel.setResourceTags(resource.id, TAGS);
    console.log(`   ✅ tags 关联: ${TAGS.length} 个标签`);
  }

  // 创建版本记录
  db.prepare(`
    INSERT INTO resource_versions (resource_id, version, changelog, git_tag, file_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(resource.id, VERSION, CHANGELOG, `v${VERSION}`, gitPath);
  console.log('   ✅ resource_versions 版本记录');

  // 计算热度
  resourceModel.updateHotScore(resource.id);
  console.log('   ✅ hot_score 已计算\n');

  // ── 5. 重新生成 manifest ──
  console.log('📋 重新生成 manifest...');
  try {
    await manifestGenerator.regenerate();
    console.log('   ✅ manifests/index.yaml 已更新\n');
  } catch (e) {
    console.log(`   ⚠️ manifest 生成失败（非致命）: ${e.message}\n`);
  }

  // ── 6. 验证 ──
  console.log('🔍 验证迁移结果...');

  const dbRecord = resourceModel.findById(resource.id);
  console.log(`   ✅ DB: id=${dbRecord.id}, name=${dbRecord.name}, type=${dbRecord.type}, version=${dbRecord.current_version}`);

  const registryDir = path.join(process.env.REGISTRY_PATH, 'resources', RESOURCE_NAME, `v${VERSION}`);
  const registryFiles = fs.existsSync(registryDir) ? fs.readdirSync(registryDir) : [];
  console.log(`   ✅ Registry: ${registryFiles.length} 个文件`);
  registryFiles.forEach(f => console.log(`      - ${f}`));

  const metaPath = path.join(process.env.REGISTRY_PATH, 'resources', RESOURCE_NAME, 'metadata.yaml');
  const metaExists = fs.existsSync(metaPath);
  console.log(`   ✅ metadata.yaml: ${metaExists ? '存在' : '缺失'}`);

  const resourceTags = tagModel.getResourceTags(resource.id);
  console.log(`   ✅ 标签: ${resourceTags.map(t => t.name || t).join(', ')}`);

  console.log('\n🎉 迁移完成！');
  console.log(`   资源: ${DISPLAY_NAME} (${RESOURCE_NAME})`);
  console.log(`   类型: ${TYPE}`);
  console.log(`   ID: ${resource.id}`);
  console.log(`   文件数: ${files.length}`);
}

migrate().catch(err => {
  console.error('❌ 迁移失败:', err);
  process.exit(1);
});
