import * as p from '@clack/prompts';
import type { McpServerConfig } from '../types/canonical.js';
import { ConfigStore } from '../core/config-store.js';
import { ConfigDetector } from '../core/detector.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders, cleanupRemovedProviders } from '../core/merger.js';
import { readTextFile, ensureShellAlias } from '../utils/fs.js';
import { runServerWizard } from './server-wizard.js';
import { runProviderWizard } from './provider-wizard.js';
import { handleCancel, BACK } from './step-runner.js';
import { LL } from '../i18n/index.js';

export async function runMainWizard(projectRoot: string): Promise<void> {
  const store = new ConfigStore(projectRoot);
  const registry = createRegistry();

  p.intro(LL.wizard.intro());

  if (store.exists()) {
    await handleExistingConfig(store, registry, projectRoot);
    return;
  }

  await handleNewConfig(store, registry, projectRoot);
}

async function handleExistingConfig(
  store: ConfigStore,
  registry: ReturnType<typeof createRegistry>,
  projectRoot: string,
): Promise<void> {
  const config = store.load();
  const serverCount = Object.keys(config.servers).length;

  p.log.info(
    LL.wizard.existingConfigFound({
      serverCount,
      providerCount: config.providers.length,
    }),
  );

  const action = handleCancel(
      await p.select({
        message: LL.wizard.actionPrompt(),
        options: [
          { value: 'add', label: LL.wizard.actions.addServer() },
          { value: 'remove', label: LL.wizard.actions.removeServer() },
          { value: 'providers', label: LL.wizard.actions.changeProviders() },
          { value: 'sync', label: LL.wizard.actions.syncConfigs() },
          { value: 'exit', label: LL.wizard.actions.exit() },
        ],
      }),
  );

  if (action === BACK) {
    p.outro(LL.common.farewell());
    return;
  }

  switch (action) {
    case 'add': {
      const existingNames = Object.keys(config.servers);
      const result = await runServerWizard(existingNames);
      if (!result) {
        p.cancel(LL.common.operationCancelled());
        break;
      }
      store.addServer(result.name, result.config);
      p.log.success(LL.wizard.serverAdded({ name: result.name }));

      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case 'remove': {
      const names = Object.keys(config.servers);
      if (names.length === 0) {
        p.log.info(LL.wizard.noServerToRemove());
        break;
      }
      const toRemove = handleCancel(
        await p.select({
          message: LL.wizard.removeServerPrompt(),
          options: names.map((n) => ({ value: n, label: n })),
        }),
      );
      if (toRemove === BACK) break;

      const doConfirm = handleCancel(
        await p.confirm({ message: LL.wizard.confirmRemove({ name: toRemove }), initialValue: false }),
      );
      if (doConfirm === BACK || !doConfirm) break;

      store.removeServer(toRemove);
      p.log.success(LL.wizard.serverRemoved({ name: toRemove }));

      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case 'providers': {
      const newProviders = await runProviderWizard(config.providers);
      if (newProviders === BACK) break;

      const removedNames = config.providers.filter((p) => !newProviders.includes(p));
      const removedProviders = registry.getByNames(removedNames);

      store.setProviders(newProviders);
      p.log.success(LL.wizard.providersUpdated());

      if (removedProviders.length > 0) {
        const cleanupResults = cleanupRemovedProviders(removedProviders, projectRoot);
        printSyncResults(cleanupResults);
      }

      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case 'sync': {
      const providers = registry.getByNames(config.providers);
      const results = syncAllProviders(providers, projectRoot, config.servers);
      printSyncResults(results);
      break;
    }
    case 'exit':
      p.outro(LL.common.farewell());
      break;
  }
}

async function handleNewConfig(
  store: ConfigStore,
  registry: ReturnType<typeof createRegistry>,
  projectRoot: string,
): Promise<void> {
  const detector = new ConfigDetector(projectRoot, registry);
  const detections = detector.detectAll();

  let servers: Record<string, McpServerConfig> = {};

  if (detections.length > 0) {
    const lines = detections.map((det) => {
      const provider = registry.get(det.provider);
      return LL.wizard.detectedConfigLine({
        provider: provider?.config.displayName ?? det.provider,
        count: det.servers.length,
      });
    });
    p.note(lines.join('\n'), LL.wizard.detectedConfigsTitle());

    const doImport = handleCancel(
      await p.confirm({ message: LL.wizard.importDetectedConfigs(), initialValue: true }),
    );

    if (doImport === BACK) {
      p.cancel(LL.common.operationCancelled());
      return;
    }

    if (doImport) {
      for (const det of detections) {
        const provider = registry.get(det.provider);
        if (!provider) continue;
        try {
          const content = readTextFile(provider.getConfigFilePath(projectRoot));
          const parsed = provider.parse(content);
          servers = { ...servers, ...parsed };
        } catch {
          // Ignore parse errors.
        }
      }
      p.log.success(LL.wizard.importedServers({ count: Object.keys(servers).length }));
    }
  }

  if (Object.keys(servers).length === 0) {
    p.log.step(LL.wizard.setupServers());

    let addMore = true;
    while (addMore) {
      const result = await runServerWizard(Object.keys(servers));
      if (!result) {
        if (Object.keys(servers).length === 0) {
          p.cancel(LL.common.operationCancelled());
          return;
        }
        break;
      }
      servers[result.name] = result.config;
      p.log.success(LL.wizard.serverAdded({ name: result.name }));

      const more = handleCancel(
        await p.confirm({ message: LL.wizard.addAnotherServer(), initialValue: false }),
      );
      if (more === BACK) break;
      addMore = more as boolean;
    }
  }

  const providers = await runProviderWizard();
  if (providers === BACK) {
    p.cancel(LL.common.operationCancelled());
    return;
  }

  if (providers.length === 0) {
    p.log.warn(LL.wizard.noProviderSelected());
  }

  const serverList = Object.keys(servers).join(', ');
  const providerList =
    providers.map((pn) => registry.get(pn)?.config.displayName ?? pn).join(', ') || LL.common.none();
  p.note(
    LL.wizard.summaryBody({
      servers: serverList,
      providers: providerList,
    }),
    LL.wizard.summaryTitle(),
  );

  const doConfirm = handleCancel(
    await p.confirm({ message: LL.wizard.confirmGenerateFiles(), initialValue: true }),
  );

  if (doConfirm === BACK || !doConfirm) {
    p.cancel(LL.common.operationCancelled());
    return;
  }

  store.save({ version: 1, providers, servers });
  p.log.success(LL.wizard.configCreated());

  if (providers.length > 0) {
    const providerInstances = registry.getByNames(providers);
    const results = syncAllProviders(providerInstances, projectRoot, servers);
    printSyncResults(results);
  }

  p.outro(LL.wizard.setupCompleted());
}

function printSyncResults(
  results: Array<{ provider: string; filePath: string; status: string; error?: string }>,
): void {
  for (const result of results) {
    switch (result.status) {
      case 'created':
        p.log.success(LL.wizard.syncCreated({ filePath: result.filePath }));
        break;
      case 'updated':
        p.log.success(LL.wizard.syncUpdated({ filePath: result.filePath }));
        break;
      case 'deleted':
        p.log.warn(LL.wizard.syncRemoved({ filePath: result.filePath }));
        break;
      case 'error':
        p.log.error(LL.wizard.syncError({ filePath: result.filePath, error: result.error ?? '' }));
        break;
    }
  }

  if (results.some((r) => r.provider === 'copilot-cli' && r.status !== 'error')) {
    if (ensureShellAlias('copilot', 'copilot --additional-mcp-config @.copilot/mcp-config.json')) {
      p.log.success(LL.wizard.copilotAliasConfigured());
    }
  }
}
