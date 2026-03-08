import type { DetectionResult } from '../types/common.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { readTextFile } from '../utils/fs.js';

export class ConfigDetector {
  constructor(
    private projectRoot: string,
    private registry: ProviderRegistry,
  ) {}

  detectAll(): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (const provider of this.registry.getAll()) {
      // Skip global providers during detection because they do not belong to a project.
      if (!provider.config.supportsProjectConfig) continue;
      if (!provider.exists(this.projectRoot)) continue;

      try {
        const content = readTextFile(provider.getConfigFilePath(this.projectRoot));
        const servers = provider.parse(content);
        results.push({
          provider: provider.config.name,
          filePath: provider.getConfigFilePath(this.projectRoot),
          servers: Object.keys(servers),
        });
      } catch {
        // Ignore files that exist but cannot be parsed.
      }
    }

    return results;
  }
}
