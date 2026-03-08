import { Command } from 'commander';
import type { CommandContext } from './types/common.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { syncCommand } from './commands/sync.js';
import { importCommand } from './commands/import.js';
import { statusCommand } from './commands/status.js';
import { LL } from './i18n/index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('mcpx')
    .description(LL.cli.description())
    .version('0.1.0')
    .option('-d, --dir <path>', LL.cli.options.projectDirectory(), process.cwd())
    .option('--verbose', LL.cli.options.verbose(), false);

  function getContext(): CommandContext {
    const opts = program.opts();
    return {
      projectRoot: opts['dir'] as string,
      verbose: opts['verbose'] as boolean,
    };
  }

  program
    .command('init')
    .description(LL.cli.commands.init())
    .action(() => initCommand(getContext()));

  program
    .command('add')
    .description(LL.cli.commands.add())
    .argument('[name]', LL.cli.commands.serverName())
    .action((name?: string) => addCommand(getContext(), name));

  program
    .command('remove')
    .description(LL.cli.commands.remove())
    .argument('[name]', LL.cli.commands.serverName())
    .action((name?: string) => removeCommand(getContext(), name));

  program
    .command('list')
    .description(LL.cli.commands.list())
    .action(() => listCommand(getContext()));

  program
    .command('sync')
    .description(LL.cli.commands.sync())
    .action(() => syncCommand(getContext()));

  program
    .command('import')
    .description(LL.cli.commands.import())
    .argument('[provider]', LL.cli.commands.providerName())
    .action((provider?: string) => importCommand(getContext(), provider));

  program
    .command('status')
    .description(LL.cli.commands.status())
    .action(() => statusCommand(getContext()));

  // Default command: init
  program.action(() => initCommand(getContext()));

  return program;
}
