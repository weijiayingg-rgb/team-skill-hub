const gitStore = require('./git-store');

class ManifestGenerator {
  async regenerate() {
    const resources = await gitStore.scanAllResources();
    const index = {
      generated_at: new Date().toISOString(),
      total_resources: resources.length,
      resources: resources.map(r => ({
        name: r.name,
        type: r.type,
        current_version: r.currentVersion,
        tags: r.tags,
      })),
    };
    await gitStore.writeManifest(index);
    await gitStore.commitAndPush('chore: regenerate manifests/index.yaml');
    return index;
  }
}

module.exports = new ManifestGenerator();
