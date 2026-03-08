import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';
import { runServerWizard } from '../wizard/server-wizard.js';
import { LL } from '../i18n/index.js';

export async function addCommand(ctx: CommandContext, serverName?: string): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn(LL.common.noConfigFound());
    p.log.info(LL.common.runInit());
    return;
  }

  const config = store.load();
  const existingNames = Object.keys(config.servers);

  if (serverName && config.servers[serverName]) {
    p.log.warn(LL.addCommand.serverAlreadyExists({ name: serverName }));
    return;
  }

  const result = await runServerWizard(existingNames);
  if (!result) {
    p.cancel(LL.common.operationCancelled());
    return;
  }

  const updatedConfig = store.addServer(result.name, result.config);
  p.log.success(LL.addCommand.serverAddedToConfig({ name: result.name }));

  const registry = createRegistry();
  const providers = registry.getByNames(updatedConfig.providers);
  const results = syncAllProviders(providers, ctx.projectRoot, updatedConfig.servers);

  for (const r of results) {
    if (r.status === 'error') {
      p.log.error(`${r.filePath}: ${r.error}`);
    } else if (r.status !== 'unchanged') {
      p.log.success(LL.addCommand.updatedFile({ filePath: r.filePath }));
    }
  }
}
