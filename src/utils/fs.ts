import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function readJsonFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function deleteFile(filePath: string): boolean {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function ensureShellAlias(alias: string, command: string): boolean {
  const shell = process.env.SHELL ?? '';
  let rcFile: string;

  if (shell.includes('zsh')) {
    rcFile = path.join(os.homedir(), '.zshrc');
  } else if (shell.includes('bash')) {
    const bashrc = path.join(os.homedir(), '.bashrc');
    const profile = path.join(os.homedir(), '.bash_profile');
    rcFile = fs.existsSync(bashrc) ? bashrc : profile;
  } else if (shell.includes('fish')) {
    rcFile = path.join(os.homedir(), '.config', 'fish', 'config.fish');
  } else {
    return false;
  }

  if (!fs.existsSync(rcFile)) return false;

  const content = fs.readFileSync(rcFile, 'utf-8');
  if (content.includes(`alias ${alias}=`) || content.includes(`alias ${alias} `)) {
    // Update the old alias (--config-dir) to the new one (--additional-mcp-config).
    if (content.includes('--config-dir ./.copilot') && !content.includes('--additional-mcp-config')) {
      const updated = content.replace(
        /alias copilot='copilot --config-dir \.\/\.copilot'/g,
        `alias copilot='${command}'`,
      );
      fs.writeFileSync(rcFile, updated, 'utf-8');
      return true;
    }
    return false;
  }

  const line = shell.includes('fish')
    ? `\n# MCPX - ${alias} with project MCP config\nalias ${alias} '${command}'`
    : `\n# MCPX - ${alias} with project MCP config\nalias ${alias}='${command}'`;

  fs.appendFileSync(rcFile, line + '\n', 'utf-8');
  return true;
}
