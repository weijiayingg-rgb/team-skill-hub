/**
 * SkillHub 种子数据生成脚本
 * 生成示例用户、资源、互动数据
 *
 * 注意：本脚本部分直接使用 db.prepare() 操作数据库，原因如下：
 * 1. 需要清空所有表并重置自增 ID（model 层不提供此功能）
 * 2. 需要批量设置随机计数值用于测试热度算法（model.update 不支持同时更新多个计数字段）
 * 3. 版本记录的创建逻辑在 resourceManager 中与 Git 操作耦合，seed 已单独处理 Git
 * 其余操作（用户创建、资源创建、标签设置、互动创建、评论创建）均使用 model 层方法。
 */

const path = require('path');
const fs = require('fs');

// 设置数据库路径
process.env.DB_PATH = path.join(__dirname, '..', 'server', 'data', 'skillhub.db');
process.env.REGISTRY_PATH = path.join(__dirname, '..', 'server', 'data', 'skillhub-registry');

const { getDb } = require('../server/models/db');
const userModel = require('../server/models/users');
const resourceModel = require('../server/models/resources');
const interactionModel = require('../server/models/interactions');
const commentModel = require('../server/models/comments');
const tagModel = require('../server/models/tags');
const gitStore = require('../server/services/git-store');

async function seed() {
  console.log('Seeding SkillHub data...\n');

  // 初始化 Git 仓库
  try { await gitStore.init(); console.log('  Git registry initialized'); } catch (e) {}

  const db = getDb();

  // 清空现有数据（注意顺序：先删有外键依赖的表）
  db.exec('DELETE FROM interactions');
  db.exec('DELETE FROM comments');
  db.exec('DELETE FROM resource_tags');
  db.exec('DELETE FROM resource_versions');
  db.exec('DELETE FROM resources');
  db.exec('DELETE FROM tags');
  db.exec('DELETE FROM bundles');
  db.exec('DELETE FROM users');
  // 重置自增ID，确保用户ID从1开始（seed数据中硬编码了 author_id）
  db.exec("DELETE FROM sqlite_sequence WHERE name='users'");
  db.exec("DELETE FROM sqlite_sequence WHERE name='resources'");

  // 创建用户
  console.log('  Creating users...');
  const users = [
    { username: 'zhangsan', display_name: '张三', role: 'admin' },
    { username: 'lisi', display_name: '李四', role: 'member' },
    { username: 'wangwu', display_name: '王五', role: 'member' },
    { username: 'zhaoliu', display_name: '赵六', role: 'member' },
  ];
  const createdUsers = users.map(u => userModel.create(u));

  // 创建资源（同时写入 Git 仓库文件）
  console.log('  Creating resources...');
  const resourcesData = [
    { name: 'sql-review-expert', display_name: 'SQL 审查专家', type: 'skill', description: '智能 SQL 审查专家，支持 CRUD 语句性能分析、索引建议、反模式检测，适配 MySQL/PostgreSQL。', author_id: 1, platforms: ['workbuddy', 'cursor', 'claude-code'], tags: ['sql', 'review', 'database', 'performance'], filename: 'prompt.md', content: '# SQL 审查专家\n\n## 功能说明\n智能 SQL 审查专家，支持 CRUD 语句性能分析、索引建议、反模式检测。\n\n## 使用方式\n将待审查的 SQL 语句发送给本 Skill，将获得以下反馈：\n1. 性能评分（0-100）\n2. 潜在问题列表\n3. 优化建议和改写后的 SQL\n4. 索引推荐\n\n## 支持的数据库\n- MySQL 5.7+\n- PostgreSQL 12+\n\n## 检查项\n- 全表扫描风险\n- N+1 查询模式\n- 缺失索引\n- 不必要的 JOIN\n- WHERE 子句效率\n- GROUP BY / ORDER BY 优化' },
    { name: 'warehouse-naming-rules', display_name: '数仓命名规范', type: 'rules', description: '数据仓库表名、字段名、分区命名规范，覆盖 ODS/DWD/DWS/ADS 各层。', author_id: 1, platforms: ['workbuddy', 'cursor'], tags: ['warehouse', 'naming', 'standards'], filename: 'rule.md', content: '# 数据仓库命名规范\n\n## 表命名\n- ODS层：ods_{来源系统}_{业务对象}，如 ods_mysql_order\n- DWD层：dwd_{业务域}_{业务对象}_{事实类型}，如 dwd_trade_order_detail_di\n- DWS层：dws_{业务域}_{统计粒度}_{统计周期}，如 dws_trade_seller_1d\n- ADS层：ads_{应用场景}_{主题}，如 ads_gmv_dashboard\n\n## 字段命名\n- 主键：{业务对象}_id\n- 外键：{关联对象}_id\n- 金额：{描述}_amt\n- 数量：{描述}_cnt\n- 日期：{描述}_date / {描述}_dt\n- 时间戳：{描述}_ts\n- 标志位：is_{描述}\n\n## 分区命名\n- 日分区：dt（格式 yyyyMMdd）\n- 小时分区：hh（格式 HH）\n- 地区分区：region' },
    { name: 'db-admin-expert', display_name: '数据库管理专家', type: 'expert', description: 'DBA 日常管理专家，支持备份恢复、性能调优、容量规划。', author_id: 2, platforms: ['workbuddy', 'claude-code'], tags: ['database', 'admin', 'dba'], filename: 'prompt.md', content: '# 数据库管理专家\n\n## 角色定位\n你是一位资深 DBA，擅长 MySQL 和 PostgreSQL 的日常运维管理。\n\n## 核心能力\n1. **备份与恢复**：制定备份策略、验证恢复流程、RTO/RPO 评估\n2. **性能调优**：慢查询分析、执行计划解读、参数调优\n3. **容量规划**：存储增长预测、分库分表方案设计\n4. **高可用架构**：主从复制、读写分离、故障切换\n5. **安全审计**：权限管理、SQL 注入防护、敏感数据脱敏\n\n## 工作流程\n1. 收集当前数据库状态信息\n2. 分析问题根因\n3. 给出分级建议（紧急/重要/优化）\n4. 提供可执行的 SQL 或配置变更命令' },
    { name: 'pre-commit-sql-check', display_name: 'Pre-commit SQL 检查', type: 'hook', description: 'Git pre-commit 钩子：提交前自动检查 SQL 文件语法和性能问题。', author_id: 2, platforms: ['workbuddy', 'cursor'], tags: ['sql', 'git', 'hook', 'pre-commit'], filename: 'hook.sh', content: '#!/bin/bash\n# Pre-commit SQL Check Hook\n# 提交前自动检查 SQL 文件的语法和常见性能问题\n\necho "Running pre-commit SQL check..."\n\nSQL_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E \'\\.sql$\')\n\nif [ -z "$SQL_FILES" ]; then\n  echo "No SQL files to check."\n  exit 0\nfi\n\nERRORS=0\n\nfor file in $SQL_FILES; do\n  echo "Checking: $file"\n\n  # 检查 SELECT *\n  if grep -niE \'SELECT\\s+\\*\' "$file"; then\n    echo "  ⚠️  WARNING: Found SELECT * — consider specifying columns"\n    ERRORS=$((ERRORS + 1))\n  fi\n\n  # 检查缺少 WHERE 的 UPDATE/DELETE\n  if grep -niE \'(UPDATE|DELETE)\\s+.*[^;]$\' "$file" | grep -vi \'WHERE\'; then\n    echo "  ❌ ERROR: UPDATE/DELETE without WHERE clause detected"\n    ERRORS=$((ERRORS + 1))\n  fi\n\n  # 检查未加引号的标识符\n  if grep -niE \'CREATE TABLE [a-z]+[^`]\' "$file"; then\n    echo "  ⚠️  WARNING: Table name may need backtick quoting"\n  fi\ndone\n\nif [ $ERRORS -gt 0 ]; then\n  echo "❌ SQL check found $ERRORS issue(s). Fix before committing."\n  exit 1\nfi\n\necho "✅ All SQL checks passed."' },
    { name: 'data-pipeline-template', display_name: '数据管道模板', type: 'template', description: 'Spark/Flink 数据处理管道模板，包含配置文件和示例代码。', author_id: 3, platforms: ['workbuddy'], tags: ['spark', 'flink', 'pipeline'], filename: 'pipeline_template.py', content: '# Data Pipeline Template\n# Spark/Flink 数据处理管道模板\n\nfrom pyspark.sql import SparkSession\nfrom pyspark.sql import functions as F\n\ndef create_spark_session(app_name="DataPipeline"):\n    """创建 Spark Session"""\n    return SparkSession.builder \\\n        .appName(app_name) \\\n        .config("spark.sql.shuffle.partitions", "200") \\\n        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \\\n        .getOrCreate()\n\ndef extract(spark, source_path):\n    """数据抽取"""\n    df = spark.read.parquet(source_path)\n    print(f"Extracted {df.count()} rows from {source_path}")\n    return df\n\ndef transform(df):\n    """数据转换"""\n    result = df \\\n        .filter(F.col("status") == "active") \\\n        .withColumn("processed_date", F.current_date()) \\\n        .groupBy("category") \\\n        .agg(\n            F.count("*").alias("record_count"),\n            F.sum("amount").alias("total_amount"),\n            F.avg("amount").alias("avg_amount")\n        )\n    return result\n\ndef load(df, target_path):\n    """数据加载"""\n    df.write \\\n        .mode("overwrite") \\\n        .partitionBy("category") \\\n        .parquet(target_path)\n    print(f"Loaded data to {target_path}")\n\nif __name__ == "__main__":\n    spark = create_spark_session()\n    raw_df = extract(spark, "/data/raw/orders")\n    transformed_df = transform(raw_df)\n    load(transformed_df, "/data/processed/order_summary")\n    spark.stop()' },
    { name: 'etl-workflow', display_name: 'ETL 工作流', type: 'workflow', description: '标准 ETL 工作流定义：抽取、转换、加载、校验、通知。', author_id: 3, platforms: ['workbuddy', 'cursor', 'claude-code'], tags: ['etl', 'workflow', 'data-engineering'], filename: 'workflow.md', content: '# ETL 工作流定义\n\n## 概述\n标准 ETL 工作流，包含完整的抽取-转换-加载-校验-通知链路。\n\n## 步骤\n\n### 1. Extract（抽取）\n- 从源系统拉取增量/全量数据\n- 记录抽取时间窗口和水位线\n- 数据落地到 ODS 层\n\n### 2. Transform（转换）\n- 数据清洗：去重、空值处理、格式标准化\n- 业务逻辑：关联维度表、计算指标、打标签\n- 输出到 DWD/DWS 层\n\n### 3. Load（加载）\n- 按分区写入目标表\n- 支持 upsert 和 overwrite 模式\n- 记录写入行数和时间\n\n### 4. Validate（校验）\n- 主键唯一性检查\n- 行数波动告警（环比 > 30%）\n- 关键指标合理性校验\n\n### 5. Notify（通知）\n- 成功：发送完成报告\n- 失败：触发告警并附带错误日志\n- 延迟：标记 SLA 超时' },
    { name: 'api-design-rules', display_name: 'API 设计规范', type: 'rules', description: 'RESTful API 设计规范，包含路由命名、状态码、错误格式约定。', author_id: 4, platforms: ['cursor'], tags: ['api', 'rest', 'design', 'standards'], filename: 'rule.md', content: '# RESTful API 设计规范\n\n## URL 设计\n- 使用名词复数：/users, /orders\n- 层级不超过3级：/users/{id}/orders\n- 使用连字符分隔：/user-profiles（非 userProfile）\n- 版本号放路径：/v1/users\n\n## HTTP 方法\n- GET：查询资源\n- POST：创建资源\n- PUT：全量更新\n- PATCH：部分更新\n- DELETE：删除资源\n\n## 状态码\n- 200：成功\n- 201：创建成功\n- 204：删除成功（无返回体）\n- 400：请求参数错误\n- 401：未认证\n- 403：无权限\n- 404：资源不存在\n- 429：请求频率超限\n- 500：服务器内部错误\n\n## 统一响应格式\n```json\n{\n  "success": true,\n  "data": {},\n  "meta": { "page": 1, "pageSize": 20, "total": 100 }\n}\n```\n\n## 错误响应格式\n```json\n{\n  "success": false,\n  "error": { "code": "VALIDATION_ERROR", "message": "描述信息" }\n}\n```' },
    { name: 'code-review-expert', display_name: '代码审查专家', type: 'expert', description: '自动化代码审查：检查代码风格、潜在 Bug、安全漏洞、性能问题。', author_id: 4, platforms: ['workbuddy', 'cursor', 'claude-code'], tags: ['code-review', 'quality'], filename: 'prompt.md', content: '# 代码审查专家\n\n## 角色\n你是一位资深代码审查员，负责对提交的代码进行全面审查。\n\n## 审查维度\n\n### 1. 正确性\n- 逻辑是否正确\n- 边界条件是否处理\n- 异常路径是否覆盖\n- 并发安全性\n\n### 2. 可读性\n- 命名是否清晰有意义\n- 函数长度是否合理（< 50行）\n- 注释是否必要且准确\n- 代码结构是否清晰\n\n### 3. 安全性\n- 输入是否校验和转义\n- 敏感数据是否保护\n- 依赖是否有已知漏洞\n- 认证授权是否正确\n\n### 4. 性能\n- 是否存在 N+1 查询\n- 是否有不必要的内存分配\n- 算法复杂度是否合理\n- 是否有缓存机会\n\n## 输出格式\n对每个发现标注严重级别：\n- 🔴 Critical：必须修复\n- 🟡 Warning：建议修复\n- 💡 Suggestion：可选优化' },
    { name: 'python-test-template', display_name: 'Python 测试模板', type: 'template', description: 'Python 单元测试和集成测试模板，支持 pytest + coverage。', author_id: 1, platforms: ['workbuddy', 'cursor'], tags: ['python', 'test', 'pytest'], filename: 'test_template.py', content: '# Python Test Template\n# pytest + coverage 测试模板\n\nimport pytest\nfrom unittest.mock import Mock, patch\n\n\n# === Fixtures ===\n@pytest.fixture\ndef sample_data():\n    """准备测试数据"""\n    return {\n        "name": "test_user",\n        "email": "test@example.com",\n        "age": 25,\n    }\n\n\n@pytest.fixture\ndef mock_service():\n    """Mock 外部服务"""\n    service = Mock()\n    service.get_user.return_value = {"id": 1, "name": "test"}\n    service.save_user.return_value = True\n    return service\n\n\n# === 单元测试 ===\nclass TestUserService:\n    """用户服务测试"""\n\n    def test_create_user_success(self, sample_data, mock_service):\n        """测试正常创建用户"""\n        # Arrange\n        # Act\n        result = mock_service.save_user(sample_data)\n        # Assert\n        assert result is True\n        mock_service.save_user.assert_called_once_with(sample_data)\n\n    def test_create_user_invalid_email(self, sample_data):\n        """测试无效邮箱地址"""\n        sample_data["email"] = "invalid-email"\n        with pytest.raises(ValueError, match="Invalid email"):\n            validate_email(sample_data["email"])\n\n    @pytest.mark.parametrize("age,expected", [\n        (0, False),\n        (17, False),\n        (18, True),\n        (65, True),\n    ])\n    def test_age_validation(self, age, expected):\n        """参数化测试年龄验证"""\n        assert is_valid_age(age) == expected\n\n\n# === 集成测试 ===\nclass TestUserAPI:\n    """用户 API 集成测试"""\n\n    @patch("requests.post")\n    def test_api_create_user(self, mock_post):\n        """测试 API 创建用户接口"""\n        mock_post.return_value.status_code = 201\n        mock_post.return_value.json.return_value = {"id": 1}\n        # ... 调用实际 API 逻辑\n\n\n# === 运行说明 ===\n# pytest test_template.py -v              # 详细输出\n# pytest test_template.py --cov=.         # 覆盖率\n# pytest test_template.py -k "create"     # 按关键字筛选' },
    { name: 'docker-compose-skill', display_name: 'Docker Compose 编排技能', type: 'skill', description: 'Docker Compose 服务编排技能：自动生成 docker-compose.yml，配置网络、卷、健康检查。', author_id: 2, platforms: ['workbuddy', 'cursor', 'claude-code'], tags: ['docker', 'compose', 'devops'], filename: 'prompt.md', content: '# Docker Compose 编排技能\n\n## 功能\n根据需求自动生成 docker-compose.yml 配置文件。\n\n## 支持的配置项\n- 多服务编排（web, api, db, cache, mq）\n- 网络配置（bridge, host, overlay）\n- 数据卷挂载（named volumes, bind mounts）\n- 环境变量管理（env_file, environment）\n- 健康检查（healthcheck）\n- 资源限制（deploy.resources）\n- 依赖关系（depends_on + condition）\n- 日志配置（logging driver）\n\n## 使用示例\n输入：我需要一个 Node.js + PostgreSQL + Redis 的开发环境\n\n输出：完整的 docker-compose.yml，包含：\n- node-app 服务（端口映射、源码挂载、热重载）\n- postgres 服务（持久化存储、初始化脚本）\n- redis 服务（内存限制、持久化配置）\n- 共享网络和健康检查' },
    { name: 'release-checklist-hook', display_name: '发布检查清单', type: 'hook', description: 'Git pre-push 钩子：确保发布前完成代码审查、测试通过、文档更新。', author_id: 3, platforms: ['workbuddy'], tags: ['release', 'checklist', 'git'], filename: 'hook.sh', content: '#!/bin/bash\n# Release Checklist Hook\n# pre-push 钩子：发布前自动检查清单\n\necho "🔍 Running release checklist..."\n\nPASSED=0\nFAILED=0\n\n# 1. 检查测试是否通过\necho "\n[1/4] Running tests..."\nif npm test 2>/dev/null; then\n  echo "  ✅ Tests passed"\n  PASSED=$((PASSED + 1))\nelse\n  echo "  ❌ Tests failed"\n  FAILED=$((FAILED + 1))\nfi\n\n# 2. 检查 lint\necho "[2/4] Running linter..."\nif npm run lint 2>/dev/null; then\n  echo "  ✅ Lint passed"\n  PASSED=$((PASSED + 1))\nelse\n  echo "  ❌ Lint errors found"\n  FAILED=$((FAILED + 1))\nfi\n\n# 3. 检查 CHANGELOG 是否更新\necho "[3/4] Checking CHANGELOG..."\nif git diff --cached --name-only | grep -qiE \'CHANGE|HISTORY|RELEASE\'; then\n  echo "  ✅ CHANGELOG updated"\n  PASSED=$((PASSED + 1))\nelse\n  echo "  ⚠️  CHANGELOG not updated (warning only)"\n  PASSED=$((PASSED + 1))\nfi\n\n# 4. 检查版本号\necho "[4/4] Checking version bump..."\nif git log --oneline -5 | grep -qiE \'bump|version|release\'; then\n  echo "  ✅ Version bumped"\n  PASSED=$((PASSED + 1))\nelse\n  echo "  ⚠️  No version bump detected (warning only)"\n  PASSED=$((PASSED + 1))\nfi\n\necho "\n📋 Results: $PASSED passed, $FAILED failed"\n\nif [ $FAILED -gt 0 ]; then\n  echo "❌ Release blocked. Fix the above issues first."\n  exit 1\nfi\n\necho "✅ Release checklist passed!"' },
    { name: 'hive-optimization-rules', display_name: 'Hive 优化规则', type: 'rules', description: 'Hive SQL 优化规则集：分区裁剪、小文件合并、数据倾斜处理。', author_id: 4, platforms: ['workbuddy'], tags: ['hive', 'optimization', 'big-data'], filename: 'rule.md', content: '# Hive SQL 优化规则\n\n## 1. 分区裁剪\n- 始终在 WHERE 中指定分区字段\n- 避免对分区字段使用函数：❌ substr(dt,1,6) → ✅ dt >= \'20240101\'\n- 动态分区时设置合理上限：set hive.exec.max.dynamic.partitions=1000\n\n## 2. 小文件合并\n- 输出合并：set hive.merge.mapfiles=true\n- Map端合并：set hive.merge.size.per.task=256000000\n- 使用 ORC/Parquet 格式自带合并能力\n\n## 3. 数据倾斜处理\n- 开启倾斜优化：set hive.optimize.skewjoin=true\n- Map端聚合：set hive.map.aggr=true\n- 两阶段聚合：先加随机前缀局部聚合，再去前缀全局聚合\n- 过滤热点key单独处理\n\n## 4. JOIN 优化\n- 小表广播：/*+ MAPJOIN(small_table) */\n- 大表JOIN大表：确保ON字段有索引或bucket\n- 避免笛卡尔积\n- LEFT JOIN 优于 NOT IN 子查询\n\n## 5. 资源控制\n- 合理设置 mapper/reducer 数量\n- 控制单个任务内存：set mapreduce.map.memory.mb=4096\n- 开启向量化执行：set hive.vectorized.execution.enabled=true' },
  ];

  const createdResources = [];
  for (const r of resourcesData) {
    const version = '1.0.0';
    const gitPath = `resources/${r.name}/v${version}`;

    // 写入 Git 仓库文件
    await gitStore.ensureResourceDir(r.name, version);
    await gitStore.writeResourceFile(r.name, version, r.filename, r.content);

    // 写入 metadata.yaml
    const metadataYaml = {
      name: r.name,
      display_name: r.display_name,
      type: r.type,
      description: r.description,
      author: '',
      tags: r.tags,
      versions: [{
        version,
        date: new Date().toISOString().split('T')[0],
        changelog: '初始版本',
        entry_file: r.filename,
      }],
    };
    await gitStore.writeMetadata(r.name, metadataYaml);

    const resource = resourceModel.create({
      name: r.name,
      display_name: r.display_name,
      type: r.type,
      description: r.description,
      author_id: r.author_id,
      git_path: gitPath,
      status: 'published',
    });

    // 设置标签
    if (r.tags.length > 0) {
      tagModel.setResourceTags(resource.id, r.tags);
    }

    // 创建版本记录
    db.prepare(`
      INSERT INTO resource_versions (resource_id, version, changelog, git_tag, file_url)
      VALUES (?, '1.0.0', '初始版本', 'v1.0.0', ?)
    `).run(resource.id, gitPath);

    // 设置初始计数
    const dl = Math.floor(Math.random() * 50) + 5;
    const likes = Math.floor(Math.random() * 30) + 3;
    const favs = Math.floor(Math.random() * 15) + 1;
    const comments = Math.floor(Math.random() * 8) + 0;

    db.prepare(`UPDATE resources SET download_count = ?, like_count = ?, favorite_count = ?, comment_count = ? WHERE id = ?`)
      .run(dl, likes, favs, comments, resource.id);

    createdResources.push(resource);
  }

  // Git commit 所有种子资源文件
  console.log('  Committing seed files to Git...');
  await gitStore.commitAndPush('feat: add seed resources with files');

  // 创建互动数据
  console.log('  Creating interactions...');
  for (let i = 0; i < createdResources.length; i++) {
    const resource = createdResources[i];
    // 随机用户对每个资源的互动
    for (let userId of [1, 2, 3, 4]) {
      if (userId === resource.author_id) continue;
      if (i % 3 === 0 || i % 2 === 0) {
        interactionModel.create(userId, resource.id, 'download');
      }
      if (i % 4 === 0 || i % 5 === 0) {
        interactionModel.create(userId, resource.id, 'like');
      }
      if (i % 7 === 0 || i % 3 === 0) {
        interactionModel.create(userId, resource.id, 'favorite');
      }
    }
  }

  // 添加一些评论
  console.log('  Creating comments...');
  const sampleComments = [
    '非常实用的资源！',
    '帮我解决了不少问题，推荐。',
    '希望能支持更多平台。',
    '文档很清晰，上手容易。',
    '建议增加错误处理示例。',
  ];
  for (let i = 0; i < 5; i++) {
    const resource = createdResources[i % createdResources.length];
    const userId = (i % 4) + 1;
    commentModel.create({
      user_id: userId,
      resource_id: resource.id,
      content: sampleComments[i % sampleComments.length],
    });
  }

  // 更新所有热度分
  console.log('  Updating hot scores...');
  resourceModel.updateAllHotScores();

  console.log('\nSeed data created successfully!');
  console.log(`  Users: ${createdUsers.length}`);
  console.log(`  Resources: ${createdResources.length}`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
