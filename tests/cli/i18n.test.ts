import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const promptMocks = vi.hoisted(() => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
  },
  cancel: vi.fn(),
  note: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  isCancel: vi.fn(() => false),
}));

vi.mock('@clack/prompts', () => promptMocks);

import { createCli } from '../../src/cli.js';
import { listCommand } from '../../src/commands/list.js';
import { LL, defaultLocale } from '../../src/i18n/index.js';

describe('CLI i18n', () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpx-cli-i18n-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('uses English as the default locale for command descriptions', () => {
    const program = createCli();

    expect(defaultLocale).toBe('en');
    expect(program.description()).toBe(LL.cli.description());
    expect(program.commands.find((command) => command.name() === 'init')?.description()).toBe(
      LL.cli.commands.init(),
    );
    expect(program.commands.find((command) => command.name() === 'import')?.description()).toBe(
      LL.cli.commands.import(),
    );
    expect(program.commands.find((command) => command.name() === 'status')?.description()).toBe(
      LL.cli.commands.status(),
    );
  });

  it('shows the default English missing-config guidance', async () => {
    await listCommand({ projectRoot: tmpDir, verbose: false });

    expect(promptMocks.log.warn).toHaveBeenCalledWith(LL.common.noConfigFound());
    expect(promptMocks.log.info).toHaveBeenCalledWith(LL.common.runInit());
  });
});
