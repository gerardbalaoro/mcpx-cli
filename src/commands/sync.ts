import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';
import { ensureShellAlias } from '../utils/fs.js';
import { LL } from '../i18n/index.js';

export async function syncCommand(ctx: CommandContext): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn(LL.common.noConfigFound());
    p.log.info(LL.common.runInit());
    return;
  }

  const config = store.load();
  const registry = createRegistry();
  const providers = registry.getByNames(config.providers);

  if (providers.length === 0) {
    p.log.warn(LL.syncCommand.noProviderConfigured());
    return;
  }

  const sp = p.spinner();
  sp.start(LL.syncCommand.syncing());

  const results = syncAllProviders(providers, ctx.projectRoot, config.servers);

  sp.stop(LL.syncCommand.syncComplete());

  let updated = 0;
  let created = 0;
  let unchanged = 0;
  let deleted = 0;
  let errors = 0;

  for (const result of results) {
    switch (result.status) {
      case 'created':
        p.log.success(LL.syncCommand.created({ filePath: result.filePath }));
        created++;
        break;
      case 'updated':
        p.log.success(LL.syncCommand.updated({ filePath: result.filePath }));
        updated++;
        break;
      case 'unchanged':
        p.log.step(LL.syncCommand.unchanged({ filePath: result.filePath }));
        unchanged++;
        break;
      case 'deleted':
        p.log.warn(LL.syncCommand.deleted({ filePath: result.filePath }));
        deleted++;
        break;
      case 'error':
        p.log.error(`${result.filePath}: ${result.error}`);
        errors++;
        break;
    }
  }

  const parts: string[] = [];
  if (created > 0) parts.push(LL.syncCommand.createdCount({ count: created }));
  if (updated > 0) parts.push(LL.syncCommand.updatedCount({ count: updated }));
  if (deleted > 0) parts.push(LL.syncCommand.deletedCount({ count: deleted }));
  if (unchanged > 0) parts.push(LL.syncCommand.unchangedCount({ count: unchanged }));
  if (errors > 0) parts.push(LL.syncCommand.errorCount({ count: errors }));

  p.log.info(LL.syncCommand.summary({ count: results.length, parts: parts.join(', ') }));

  if (config.providers.includes('copilot-cli')) {
    if (ensureShellAlias('copilot', 'copilot --additional-mcp-config @.copilot/mcp-config.json')) {
      p.log.success(LL.syncCommand.copilotAliasConfigured());
    }
  }
}
