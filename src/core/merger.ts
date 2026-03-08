import nodePath from 'node:path';
import type { McpServerConfig } from '../types/canonical.js';
import type { Provider } from '../types/providers.js';
import type { SyncResult } from '../types/common.js';
import { readTextFile, writeTextFile, fileExists, deleteFile } from '../utils/fs.js';

export function syncProvider(
  provider: Provider,
  projectRoot: string,
  servers: Record<string, McpServerConfig>,
): SyncResult {
  const filePath = provider.getConfigFilePath(projectRoot);
  const newContent = provider.generate(servers);

  try {
    if (fileExists(filePath)) {
      const currentContent = readTextFile(filePath);
      const mergedContent = provider.generate(servers, currentContent);
      if (currentContent === mergedContent) {
        return { provider: provider.config.name, filePath, status: 'unchanged' };
      }
      writeTextFile(filePath, mergedContent);
      return { provider: provider.config.name, filePath, status: 'updated' };
    }

    writeTextFile(filePath, newContent);
    return { provider: provider.config.name, filePath, status: 'created' };
  } catch (err) {
    return {
      provider: provider.config.name,
      filePath,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function syncAllProviders(
  providers: Provider[],
  projectRoot: string,
  servers: Record<string, McpServerConfig>,
): SyncResult[] {
  return providers.map((provider) => syncProvider(provider, projectRoot, servers));
}

export function cleanupRemovedProviders(
  removedProviders: Provider[],
  projectRoot: string,
): SyncResult[] {
  const results: SyncResult[] = [];

  for (const provider of removedProviders) {
    const filePath = provider.getConfigFilePath(projectRoot);
    try {
      if (deleteFile(filePath)) {
        results.push({ provider: provider.config.name, filePath, status: 'deleted' });
      }
    } catch (err) {
      results.push({
        provider: provider.config.name,
        filePath,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Clean up the legacy project file for global providers.
    if (!provider.config.supportsProjectConfig && provider.config.globalConfigPath) {
      const projectFilePath = nodePath.join(projectRoot, provider.config.configPath);
      try {
        if (deleteFile(projectFilePath)) {
          results.push({ provider: provider.config.name, filePath: projectFilePath, status: 'deleted' });
        }
      } catch {
        // Ignore cleanup errors for legacy files.
      }
    }
  }

  return results;
}
