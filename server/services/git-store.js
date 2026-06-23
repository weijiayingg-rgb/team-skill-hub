const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');

class GitStore {
  constructor() {
    this.registryPath = config.registryPath;
    this.git = simpleGit(this.registryPath);
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    if (!fs.existsSync(this.registryPath)) {
      fs.mkdirSync(this.registryPath, { recursive: true });
    }

    const isRepo = fs.existsSync(path.join(this.registryPath, '.git'));

    if (!isRepo) {
      await this.git.init();
      await this.git.addConfig('user.name', 'SkillHub');
      await this.git.addConfig('user.email', 'skillhub@local');

      // 创建基础目录结构和 README
      fs.mkdirSync(path.join(this.registryPath, 'resources'), { recursive: true });
      fs.mkdirSync(path.join(this.registryPath, 'bundles'), { recursive: true });
      fs.mkdirSync(path.join(this.registryPath, 'manifests'), { recursive: true });

      const readme = `# SkillHub Registry\n\n跨平台 AI 资源注册中心，由 SkillHub Server 自动管理。\n`;
      fs.writeFileSync(path.join(this.registryPath, 'README.md'), readme, 'utf-8');

      await this.git.add('.');
      await this.git.commit('chore: initialize agent hub registry');
    }

    this.initialized = true;
  }

  async ensureResourceDir(resourceName, version) {
    await this.init();
    const versionDir = path.join(this.registryPath, 'resources', resourceName, `v${version}`);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }
    return versionDir;
  }

  /**
   * 写入资源文件（支持子目录路径，如 skills/review.md）
   *
   * 安全防护：拒绝路径遍历（..）和路径逃逸
   */
  async writeResourceFile(resourceName, version, filename, content) {
    // zip-slip 防护：不允许 .. 出现在 filename 中
    if (filename.includes('..')) {
      throw new Error(`拒绝路径遍历: ${filename}`);
    }

    const versionDir = await this.ensureResourceDir(resourceName, version);
    const filePath = path.join(versionDir, filename);

    // 二次校验：确保最终路径仍在 versionDir 内
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(versionDir))) {
      throw new Error(`路径逃逸: ${filePath}`);
    }

    // 确保子目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  async writeMetadata(resourceName, metadata) {
    await this.init();
    const resourceDir = path.join(this.registryPath, 'resources', resourceName);
    if (!fs.existsSync(resourceDir)) {
      fs.mkdirSync(resourceDir, { recursive: true });
    }
    const metadataPath = path.join(resourceDir, 'metadata.yaml');
    const yamlStr = yaml.dump(metadata, { lineWidth: 120 });
    fs.writeFileSync(metadataPath, yamlStr, 'utf-8');
    return metadataPath;
  }

  async readMetadata(resourceName) {
    const metadataPath = path.join(this.registryPath, 'resources', resourceName, 'metadata.yaml');
    if (!fs.existsSync(metadataPath)) return null;
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return yaml.load(content);
  }

  async scanAllResources() {
    await this.init();
    const resourcesDir = path.join(this.registryPath, 'resources');
    if (!fs.existsSync(resourcesDir)) return [];

    const entries = fs.readdirSync(resourcesDir, { withFileTypes: true });
    const resources = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metadata = await this.readMetadata(entry.name);
      if (metadata) {
        resources.push({
          name: metadata.name || entry.name,
          type: metadata.type || 'unknown',
          currentVersion: metadata.versions?.length
            ? metadata.versions[metadata.versions.length - 1].version
            : '1.0.0',
          tags: metadata.tags || [],
        });
      }
    }

    return resources;
  }

  /**
   * 递归读取资源目录下所有文件（包含子目录）
   * 返回 [{ filename: 'prompt.md', path: 'prompt.md', content }, { filename: 'review.md', path: 'skills/review.md', content }]
   */
  async readResourceFiles(resourceName, version) {
    const versionDir = path.join(this.registryPath, 'resources', resourceName, `v${version}`);
    if (!fs.existsSync(versionDir)) return [];

    const files = [];
    const walkDir = (dir, prefix) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walkDir(fullPath, relativePath);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            files.push({ filename: entry.name, path: relativePath, content });
          } catch {
            // 跳过无法读取的二进制文件
          }
        }
      }
    };

    walkDir(versionDir, '');
    return files;
  }

  async writeManifest(index) {
    await this.init();
    const manifestsDir = path.join(this.registryPath, 'manifests');
    if (!fs.existsSync(manifestsDir)) {
      fs.mkdirSync(manifestsDir, { recursive: true });
    }
    const indexPath = path.join(manifestsDir, 'index.yaml');
    const yamlStr = yaml.dump(index, { lineWidth: 120 });
    fs.writeFileSync(indexPath, yamlStr, 'utf-8');
  }

  async commitAndPush(message) {
    await this.git.add('.');
    try {
      await this.git.commit(message);
    } catch (e) {
      if (!e.message.includes('nothing to commit')) throw e;
    }

    if (config.registryGitUrl) {
      try {
        await this.git.push('origin', config.registryGitBranch);
      } catch (e) {
        console.warn('Git push failed (non-fatal):', e.message);
      }
    }
  }

  async deleteResource(resourceName) {
    const resourceDir = path.join(this.registryPath, 'resources', resourceName);
    if (fs.existsSync(resourceDir)) {
      fs.rmSync(resourceDir, { recursive: true, force: true });
    }
  }
}

module.exports = new GitStore();
