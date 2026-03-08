import * as p from '@clack/prompts';
import type { McpServerConfig } from '../types/canonical.js';
import { isValidServerName } from '../utils/validation.js';
import { handleCancel, BACK, runSteps, type Step } from './step-runner.js';
import { LL } from '../i18n/index.js';

export interface ServerWizardResult {
  name: string;
  config: McpServerConfig;
}

interface ServerState {
  name: string;
  transport: 'stdio' | 'http';
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
  description: string;
}

export async function runServerWizard(existingNames: string[] = []): Promise<ServerWizardResult | null> {
  const stepName: Step<ServerState> = async () => {
    const result = handleCancel(
      await p.text({
        message: LL.serverWizard.nameMessage(),
        placeholder: LL.serverWizard.namePlaceholder(),
        validate: (v) => {
          const value = v?.trim() ?? '';
          if (!value) return LL.serverWizard.nameRequired();
          if (!isValidServerName(value)) return LL.serverWizard.invalidName();
          if (existingNames.includes(value)) return LL.serverWizard.nameAlreadyExists({ name: value });
        },
      }),
    );
    if (result === BACK) return BACK;
    return { name: (result as string).trim() };
  };

  const stepTransport: Step<ServerState> = async () => {
    const result = handleCancel(
      await p.select({
        message: LL.serverWizard.transportMessage(),
        options: [
          { value: 'stdio' as const, label: 'stdio', hint: LL.serverWizard.stdioHint() },
          { value: 'http' as const, label: 'http', hint: LL.serverWizard.httpHint() },
        ],
      }),
    );
    if (result === BACK) return BACK;
    return { transport: result };
  };

  const stepStdioCommand: Step<ServerState> = async (state) => {
    if (state.transport !== 'stdio') return {};

    const cmd = handleCancel(
      await p.text({ message: LL.serverWizard.commandMessage(), placeholder: LL.serverWizard.commandPlaceholder() }),
    );
    if (cmd === BACK) return BACK;

    const argsStr = handleCancel(
      await p.text({
        message: LL.serverWizard.argsMessage(),
        placeholder: LL.serverWizard.argsPlaceholder(),
        initialValue: '',
      }),
    );
    if (argsStr === BACK) return BACK;

    const args = (argsStr as string)
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    return { command: cmd as string, args };
  };

  const stepStdioEnv: Step<ServerState> = async (state) => {
    if (state.transport !== 'stdio') return {};

    const env: Record<string, string> = {};
    const shouldAdd = handleCancel(
      await p.confirm({ message: LL.serverWizard.addEnv(), initialValue: false }),
    );
    if (shouldAdd === BACK) return BACK;

    if (shouldAdd) {
      let addMore = true;
      while (addMore) {
        const key = handleCancel(
          await p.text({
            message: LL.serverWizard.envNameMessage(),
            placeholder: LL.serverWizard.envNamePlaceholder(),
          }),
        );
        if (key === BACK) break;

        const value = handleCancel(
          await p.text({ message: LL.serverWizard.envValueMessage({ name: String(key) }) }),
        );
        if (value === BACK) break;

        env[key as string] = value as string;

        const more = handleCancel(
          await p.confirm({ message: LL.serverWizard.addAnotherEnv(), initialValue: false }),
        );
        if (more === BACK) break;
        addMore = more as boolean;
      }
    }

    return { env };
  };

  const stepHttpUrl: Step<ServerState> = async (state) => {
    if (state.transport !== 'http') return {};

    const url = handleCancel(
      await p.text({ message: LL.serverWizard.urlMessage(), placeholder: LL.serverWizard.urlPlaceholder() }),
    );
    if (url === BACK) return BACK;
    return { url: url as string };
  };

  const stepHttpHeaders: Step<ServerState> = async (state) => {
    if (state.transport !== 'http') return {};

    const headers: Record<string, string> = {};
    const shouldAdd = handleCancel(
      await p.confirm({ message: LL.serverWizard.addHeaders(), initialValue: false }),
    );
    if (shouldAdd === BACK) return BACK;

    if (shouldAdd) {
      let addMore = true;
      while (addMore) {
        const key = handleCancel(
          await p.text({
            message: LL.serverWizard.headerNameMessage(),
            placeholder: LL.serverWizard.headerNamePlaceholder(),
          }),
        );
        if (key === BACK) break;

        const value = handleCancel(
          await p.text({ message: LL.serverWizard.headerValueMessage({ name: String(key) }) }),
        );
        if (value === BACK) break;

        headers[key as string] = value as string;

        const more = handleCancel(
          await p.confirm({ message: LL.serverWizard.addAnotherHeader(), initialValue: false }),
        );
        if (more === BACK) break;
        addMore = more as boolean;
      }
    }

    return { headers };
  };

  const stepDescription: Step<ServerState> = async () => {
    const desc = handleCancel(
      await p.text({
        message: LL.serverWizard.descriptionMessage(),
        initialValue: '',
        placeholder: LL.serverWizard.descriptionPlaceholder(),
      }),
    );
    if (desc === BACK) return BACK;
    return { description: desc as string };
  };

  const result = await runSteps<ServerState>(
    [stepName, stepTransport, stepStdioCommand, stepStdioEnv, stepHttpUrl, stepHttpHeaders, stepDescription],
    {},
  );

  if (!result) return null;

  const config: McpServerConfig = { transport: result.transport };

  if (result.transport === 'stdio') {
    config.command = result.command;
    if (result.args?.length) config.args = result.args;
    if (result.env && Object.keys(result.env).length) config.env = result.env;
  } else {
    config.url = result.url;
    if (result.headers && Object.keys(result.headers).length) config.headers = result.headers;
  }

  if (result.description) config.description = result.description;

  return { name: result.name, config };
}
