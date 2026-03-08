import * as p from '@clack/prompts';
import type { ProviderName } from '../types/canonical.js';
import { PROVIDER_NAMES } from '../types/canonical.js';
import { createRegistry } from '../providers/registry.js';
import { handleCancel, BACK, type BackSignal } from './step-runner.js';
import { LL } from '../i18n/index.js';

const PROVIDER_DETAILS: Record<ProviderName, { path: string; hint?: string }> = {
  'claude-code': { path: '.mcp.json' },
  'gemini-cli': { path: '.gemini/settings.json' },
  'kimi-cli': { path: '~/.kimi/mcp.json', hint: LL.providerWizard.globalHint() },
  'openai-codex': { path: '.codex/config.toml' },
  'opencode': { path: 'opencode.json' },
  'copilot-cli': { path: '.copilot/mcp-config.json' },
  'vscode': { path: '.vscode/mcp.json' },
  'intellij': { path: '.idea/mcp.json' },
};

export async function runProviderWizard(
  preSelected: ProviderName[] = [],
): Promise<ProviderName[] | BackSignal> {
  const registry = createRegistry();

  const result = handleCancel(
    await p.multiselect({
      message: LL.providerWizard.selectProviders(),
      options: PROVIDER_NAMES.map((name) => {
        const provider = registry.get(name);
        const details = PROVIDER_DETAILS[name];
        return {
          value: name,
          label: `${provider?.config.displayName ?? name}`,
          hint: `${details?.path}${details?.hint ? ` (${details.hint})` : ''}`,
        };
      }),
      initialValues: preSelected,
    }),
  );

  if (result === BACK) return BACK;
  return result;
}
