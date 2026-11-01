import { parseArgs } from 'node:util';
import type { ToolListFormat } from './utils/tool-list-formatter.js';

export interface CLIArgs {
  upstream?: string;
  upstreamStdio?: boolean;
  allow?: string;
  deny?: string;
  header?: string[];
  env?: string[];
  positionals: string[];
  listTools?: boolean;
  format?: ToolListFormat;
}

export function parseCLIArgs(): CLIArgs {
  const { values, positionals } = parseArgs({
    options: {
      upstream: {
        type: 'string',
        short: 'u',
      },
      'upstream-stdio': {
        type: 'boolean',
      },
      allow: {
        type: 'string',
        short: 'a',
      },
      deny: {
        type: 'string',
        short: 'd',
      },
      header: {
        type: 'string',
        short: 'h',
        multiple: true,
      },
      env: {
        type: 'string',
        short: 'e',
        multiple: true,
      },
      'list-tools': {
        type: 'boolean',
        short: 'l',
      },
      format: {
        type: 'string',
        short: 'f',
      },
    },
    allowPositionals: true,
  });

  const upstream = values.upstream;
  const upstreamStdio = values['upstream-stdio'];
  const allow = values.allow;
  const deny = values.deny;
  const header = values.header;
  const env = values.env;
  const listTools = values['list-tools'];
  const format = values.format as ToolListFormat | undefined;

  if (!upstream && !upstreamStdio) {
    console.error('Error: Either --upstream or --upstream-stdio is required');
    console.error(
      'Usage (HTTP): tool-filter-mcp --upstream <url> [--allow <patterns>] [--deny <patterns>] [--header <name:value>]'
    );
    console.error(
      'Usage (stdio): tool-filter-mcp --upstream-stdio [--allow <patterns>] [--deny <patterns>] [--env <KEY=value>] -- <command> [args...]'
    );
    process.exit(1);
  }

  if (upstream && upstreamStdio) {
    console.error('Error: --upstream and --upstream-stdio are mutually exclusive');
    console.error(
      'Use --upstream for HTTP/SSE servers or --upstream-stdio for stdio servers, but not both'
    );
    process.exit(1);
  }

  if (upstream) {
    try {
      new URL(upstream);
    } catch {
      console.error(`Error: Invalid upstream URL: ${upstream}`);
      process.exit(1);
    }
  }

  if (format && !['table', 'json', 'names'].includes(format)) {
    console.error(`Error: Invalid format "${format}". Must be one of: table, json, names`);
    process.exit(1);
  }

  if (positionals.length > 0) {
    console.error(
      'Warning: Positional arguments are only applicable with --upstream-stdio and will be ignored'
    );
  }

  if (upstreamStdio && positionals.length === 0) {
    console.error('Error: --upstream-stdio requires a command and arguments after --');
    console.error(
      'Usage: tool-filter-mcp --upstream-stdio [--allow <patterns>] [--deny <patterns>] [--env <KEY=value>] -- <command> [args...]'
    );
    console.error(
      'Example: tool-filter-mcp --upstream-stdio --env API_KEY=secret -- uvx --from git+https://... zen-mcp-server'
    );
    process.exit(1);
  }

  if (upstreamStdio && header && header.length > 0) {
    console.error('Warning: --header is only applicable with --upstream and will be ignored');
  }

  if (upstream && env && env.length > 0) {
    console.error('Warning: --env is only applicable with --upstream-stdio and will be ignored');
  }

  return {
    upstream,
    upstreamStdio,
    allow,
    deny,
    header,
    env,
    listTools,
    format: format || 'table',
    positionals,
  };
}
