import { describe, it, expect } from 'vitest';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { MCPServer } from '../../src/server.js';
import { HttpProxyConfig } from '../../src/types.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools, allTools } from '../fixtures/sample-tools.js';

describe('Filter All Tools', () => {
  it('should return empty tool list when all tools filtered', async () => {
    const mockServer = createMockServer(sampleTools);
    const config: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: ['.*'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy = new ProxyOrchestrator(config, mockServer as any);
    await proxy.startup();

    const tools = proxy.getCachedTools();
    expect(tools).toHaveLength(0);
  });

  it('should reject all tool calls when everything filtered', async () => {
    const mockServer = createMockServer(sampleTools);
    const config: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: ['.*'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy = new ProxyOrchestrator(config, mockServer as any);
    await proxy.startup();

    expect(proxy.isToolAllowed('read_file')).toBe(false);
    expect(proxy.isToolAllowed('write_file')).toBe(false);
    expect(proxy.isToolAllowed('list_dir')).toBe(false);
    expect(proxy.isToolAllowed('get_env')).toBe(false);
  });

  it('should return empty list from server when all tools filtered', async () => {
    const mockServer = createMockServer(sampleTools);
    const config: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: ['.*'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy = new ProxyOrchestrator(config, mockServer as any);
    await proxy.startup();

    const server = new MCPServer(proxy);
    const result = await server.handleListTools();

    expect(result.tools).toHaveLength(0);
  });

  it('should filter all tools with specific patterns', async () => {
    const mockServer = createMockServer(allTools);
    const config: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: ['.*_file$', '.*_dir$', '.*_env$', '.*_database$'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy = new ProxyOrchestrator(config, mockServer as any);
    await proxy.startup();

    const tools = proxy.getCachedTools();
    expect(tools).toHaveLength(0);
  });

  it('should remain ready even when all tools filtered', async () => {
    const mockServer = createMockServer(sampleTools);
    const config: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: ['.*'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy = new ProxyOrchestrator(config, mockServer as any);
    await proxy.startup();

    expect(proxy.isReady()).toBe(true);
    expect(proxy.getCachedTools()).toHaveLength(0);
  });

  it('should successfully start even with empty tool list', async () => {
    const mockServer = createMockServer([]);
    const config: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: [],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy = new ProxyOrchestrator(config, mockServer as any);
    await proxy.startup();

    expect(proxy.isReady()).toBe(true);
    expect(proxy.getCachedTools()).toHaveLength(0);
  });
});
