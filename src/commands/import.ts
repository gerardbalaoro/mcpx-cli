import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import type { ProviderName } from '../types/canonical.js';
import { ConfigStore } from '../core/config-store.js';
import { ConfigDetector } from '../core/detector.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';
import { readTextFile } from '../utils/fs.js';
import { handleCancel, BACK } from '../wizard/step-runner.js';
import { LL } from '../i18n/index.js';

export async function importCommand(ctx: CommandContext, providerArg?: string): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);
  const registry = createRegistry();
  const detector = new ConfigDetector(ctx.projectRoot, registry);

  const detections = detector.detectAll();

  if (detections.length === 0) {
    p.log.info(LL.importCommand.noneDetected());
    return;
  }

  const lines = detections.map((det) => {
    const provider = registry.get(det.provider);
    return LL.importCommand.detectedLine({
      provider: provider?.config.displayName ?? det.provider,
      filePath: det.filePath,
      count: det.servers.length,
    });
  });
  p.note(lines.join('\n'), LL.importCommand.detectedTitle());

  let selectedProvider: string;

  if (providerArg) {
    selectedProvider = providerArg;
  } else {
    const result = handleCancel(
      await p.select({
        message: LL.importCommand.selectProvider(),
        options: detections.map((d) => {
          const provider = registry.get(d.provider);
          return {
            value: d.provider,
            label: provider?.config.displayName ?? d.provider,
            hint: LL.importCommand.providerHint({ count: d.servers.length }),
          };
        }),
      }),
    );
    if (result === BACK) return;
    selectedProvider = result;
  }

  const provider = registry.get(selectedProvider as ProviderName);
  if (!provider) {
    p.log.error(LL.importCommand.providerNotFound({ name: selectedProvider }));
    return;
  }

  const content = readTextFile(provider.getConfigFilePath(ctx.projectRoot));
  const parsedServers = provider.parse(content);
  const serverNames = Object.keys(parsedServers);

  if (serverNames.length === 0) {
    p.log.info(LL.importCommand.noneFoundInProvider());
    return;
  }

  const selectedServers = handleCancel(
    await p.multiselect({
      message: LL.importCommand.selectServers(),
      options: serverNames.map((name) => ({ value: name, label: name })),
      initialValues: serverNames,
    }),
  );

  if (selectedServers === BACK || selectedServers.length === 0) {
    p.log.info(LL.importCommand.noneSelected());
    return;
  }

  if (!store.exists()) {
    store.createEmpty();
  }

  const config = store.load();

  for (const name of selectedServers) {
    const server = parsedServers[name];
    if (server) {
      config.servers[name] = server;
    }
  }

  store.save(config);
  p.log.success(LL.importCommand.importedIntoConfig({ count: selectedServers.length }));

  if (config.providers.length > 0) {
    const doSync = handleCancel(
      await p.confirm({ message: LL.importCommand.syncNow(), initialValue: true }),
    );

    if (doSync && doSync !== BACK) {
      const providers = registry.getByNames(config.providers);
      const results = syncAllProviders(providers, ctx.projectRoot, config.servers);
      for (const result of results) {
        if (result.status === 'error') {
          p.log.error(`${result.filePath}: ${result.error}`);
        } else if (result.status !== 'unchanged') {
          p.log.success(
            LL.importCommand.syncResult({
              action:
                result.status === 'created'
                  ? LL.importCommand.createdLabel()
                  : LL.importCommand.updatedLabel(),
              filePath: result.filePath,
            }),
          );
        }
      }
    }
  }
}
