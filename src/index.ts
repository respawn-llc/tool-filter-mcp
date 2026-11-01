#!/usr/bin/env node

import { ProxyOrchestrator } from './proxy.js';
import { createMCPServer } from './server.js';
import { formatStartupError } from './utils/error-handler.js';
import { formatCommandDisplay } from './utils/command-formatter.js';
import { formatToolsList } from './utils/tool-list-formatter.js';
import { createUpstreamClient, createStdioUpstreamClient, type WrappedClient } from './client.js';
import { parseCLIArgs, type CLIArgs } from './cli-args.js';
import { createProxyConfig } from './config.js';
import { applyFilters } from './filter.js';

async function listToolsMode(args: CLIArgs): Promise<void> {
  let upstreamClient: WrappedClient | null = null;

  try {
    const config = createProxyConfig(args);

    // Create upstream client based on config mode
    if (config.mode === 'http') {
      console.error(`Connecting to upstream MCP at ${config.upstreamUrl}...`);
      upstreamClient = await createUpstreamClient(config.upstreamUrl, config.headers);
    } else {
      const commandDisplay = formatCommandDisplay(config.upstreamCommand, config.upstreamArgs);
      console.error(`Connecting to upstream MCP via stdio: ${commandDisplay}...`);
      upstreamClient = await createStdioUpstreamClient(
        config.upstreamCommand,
        config.upstreamArgs,
        config.env
      );
    }
    await upstreamClient.connect();

    console.error('Fetching tools from upstream...');

    const result = await upstreamClient.listTools();
    const tools = applyFilters(result.tools, {
      allowPatterns: config.allowPatterns,
      denyPatterns: config.denyPatterns,
    }).allowed;

    const filterCount = config.allowPatterns.length + config.denyPatterns.length;
    if (filterCount > 0) {
      console.error(`Applied ${filterCount} filter pattern(s)`);
    }

    // Output to stdout (not stderr) so it can be piped/redirected
    const formatted = formatToolsList(tools, args.format || 'table');
    // biome-ignore lint/suspicious/noConsole: list mode writes formatted output to stdout
    console.log(formatted);
  } catch (error) {
    const errorMessage = formatStartupError(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  } finally {
    if (upstreamClient) {
      upstreamClient.disconnect();
    }
  }
}

async function main(): Promise<void> {
  try {
    const args = parseCLIArgs();

    // Handle list-tools mode
    if (args.listTools) {
      await listToolsMode(args);
      return;
    }

    const config = createProxyConfig(args);

    // Create upstream client based on config mode
    let upstreamClient: WrappedClient;

    if (config.mode === 'http') {
      console.error(`Connecting to upstream MCP at ${config.upstreamUrl}...`);
      upstreamClient = await createUpstreamClient(config.upstreamUrl, config.headers);
    } else {
      const commandDisplay = formatCommandDisplay(config.upstreamCommand, config.upstreamArgs);
      console.error(`Connecting to upstream MCP via stdio: ${commandDisplay}...`);
      upstreamClient = await createStdioUpstreamClient(
        config.upstreamCommand,
        config.upstreamArgs,
        config.env
      );
    }

    const proxy = new ProxyOrchestrator(config, upstreamClient);
    try {
      await proxy.startup();
    } catch (error) {
      upstreamClient.disconnect();
      throw error;
    }

    const filteredTools = proxy.getCachedTools();
    console.error(`Proxy ready. Filtered ${filteredTools.length} tools from upstream.`);

    if (config.allowPatterns.length > 0) {
      console.error(`Allow patterns: ${config.allowPatterns.join(', ')}`);
    }

    if (config.denyPatterns.length > 0) {
      console.error(`Deny patterns: ${config.denyPatterns.join(', ')}`);
    }

    if (config.mode === 'http' && config.headers && Object.keys(config.headers).length > 0) {
      console.error(`Custom headers: ${Object.keys(config.headers).join(', ')}`);
    }

    const server = await createMCPServer(proxy);

    console.error('MCP proxy server running on stdio');
    console.error('Press Ctrl+C to stop');

    process.on('SIGINT', () => {
      console.error('\nShutting down...');
      proxy.shutdown();
      void server.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('\nShutting down...');
      proxy.shutdown();
      void server.close();
      process.exit(0);
    });
  } catch (error) {
    const errorMessage = formatStartupError(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

void main();
