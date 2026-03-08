import path from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import type { McpServerConfig } from '../types/canonical.js';
import type { Provider, ProviderConfig } from '../types/providers.js';
import { fileExists } from '../utils/fs.js';

export class OpenAICodexProvider implements Provider {
  readonly config: ProviderConfig = {
    name: 'openai-codex',
    displayName: 'OpenAI Codex',
    configPath: '.codex/config.toml',
    supportsProjectConfig: true,
  };

  generate(servers: Record<string, McpServerConfig>, existingContent?: string): string {
    const mcpServers: Record<string, Record<string, unknown>> = {};

    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;

      if (server.transport === 'stdio') {
        mcpServers[name] = {
          command: server.command ?? '',
          ...(server.args?.length && { args: server.args }),
          ...(server.env && Object.keys(server.env).length && { env: server.env }),
          ...(server.cwd && { cwd: server.cwd }),
        };
      } else if (server.transport === 'http') {
        mcpServers[name] = {
          ...(server.url && { url: server.url }),
          ...(server.headers && Object.keys(server.headers).length && { http_headers: server.headers }),
        };
      }
    }

    if (existingContent) {
      try {
        const existing = parseToml(existingContent) as Record<string, unknown>;
        existing['mcp_servers'] = mcpServers;
        return stringifyToml(existing) + '\n';
      } catch {
        // If parsing fails, regenerate the file from scratch.
      }
    }

    return stringifyToml({ mcp_servers: mcpServers }) + '\n';
  }

  parse(content: string): Record<string, McpServerConfig> {
    const data = parseToml(content) as { mcp_servers?: Record<string, Record<string, unknown>> };
    const servers: Record<string, McpServerConfig> = {};

    for (const [name, raw] of Object.entries(data.mcp_servers ?? {})) {
      const server: McpServerConfig = {
        transport: raw['url'] ? 'http' : 'stdio',
      };
      if (raw['command']) server.command = raw['command'] as string;
      if (raw['args']) server.args = raw['args'] as string[];
      if (raw['env']) server.env = raw['env'] as Record<string, string>;
      if (raw['url']) server.url = raw['url'] as string;
      if (raw['http_headers']) server.headers = raw['http_headers'] as Record<string, string>;
      if (raw['cwd']) server.cwd = raw['cwd'] as string;
      servers[name] = server;
    }

    return servers;
  }

  getConfigFilePath(projectRoot: string): string {
    return path.join(projectRoot, this.config.configPath);
  }

  exists(projectRoot: string): boolean {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
}
