import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { readTextFile, fileExists } from '../utils/fs.js';
import { LL } from '../i18n/index.js';

export async function statusCommand(ctx: CommandContext): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn(LL.common.noConfigFound());
    p.log.info(LL.common.runInit());
    return;
  }

  const config = store.load();
  const registry = createRegistry();
  const serverCount = Object.keys(config.servers).length;

  let hasDesync = false;
  const lines: string[] = [];

  for (const providerName of config.providers) {
    const provider = registry.get(providerName);
    if (!provider) continue;

    const filePath = provider.getConfigFilePath(ctx.projectRoot);
    const expectedContent = provider.generate(config.servers);

    const displayPath = provider.config.supportsProjectConfig
      ? provider.config.configPath
      : provider.config.globalConfigPath ?? provider.config.configPath;

    let status: string;
    if (!fileExists(filePath)) {
      status = pc.red(LL.statusCommand.missing());
      hasDesync = true;
    } else {
      const currentContent = readTextFile(filePath);
      if (currentContent === expectedContent) {
        status = pc.green(LL.statusCommand.inSync());
      } else {
        status = pc.yellow(LL.statusCommand.outOfSync());
        hasDesync = true;
      }
    }

    lines.push(`${pc.bold(provider.config.displayName.padEnd(16))} ${displayPath.padEnd(30)} ${status}`);
  }

  p.note(
    lines.join('\n'),
    LL.statusCommand.summaryTitle({
      serverCount,
      providerCount: config.providers.length,
    }),
  );

  if (hasDesync) {
    p.log.warn(LL.statusCommand.someOutdated());
  } else {
    p.log.success(LL.statusCommand.allSynced());
  }
}
