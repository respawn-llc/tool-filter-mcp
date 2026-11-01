import { describe, it, expect } from 'vitest';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { HttpProxyConfig } from '../../src/types.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools, allTools } from '../fixtures/sample-tools.js';

describe('Empty Deny List', () => {
  it('should expose all tools when no deny patterns', async () => {
    const mockServer = createMockServer(sampleTools);
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

    const tools = proxy.getCachedTools();
    expect(tools).toHaveLength(4);
    expect(tools).toEqual(sampleTools);
  });

  it('should allow all tool calls when no deny patterns', async () => {
    const mockServer = createMockServer(sampleTools);
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

    expect(proxy.isToolAllowed('read_file')).toBe(true);
    expect(proxy.isToolAllowed('write_file')).toBe(true);
    expect(proxy.isToolAllowed('list_dir')).toBe(true);
    expect(proxy.isToolAllowed('get_env')).toBe(true);
  });

  it('should expose all upstream tools with empty deny list', async () => {
    const mockServer = createMockServer(allTools);
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

    const tools = proxy.getCachedTools();
    expect(tools).toHaveLength(6);
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_env',
      'list_dir',
      'query_database',
      'read_file',
      'update_database',
      'write_file',
    ]);
  });

  it('should preserve tool order from upstream', async () => {
    const mockServer = createMockServer(sampleTools);
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

    const tools = proxy.getCachedTools();
    expect(tools.map((t) => t.name)).toEqual(['read_file', 'write_file', 'list_dir', 'get_env']);
  });
});
