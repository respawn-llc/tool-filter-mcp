import { describe, it, expect } from 'vitest';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { HttpProxyConfig } from '../../src/types.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { allTools } from '../fixtures/sample-tools.js';

describe('Multiple Proxy Instances', () => {
  it('should run multiple proxies with different deny lists independently', async () => {
    const mockServer1 = createMockServer(allTools);
    const mockServer2 = createMockServer(allTools);

    const config1: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: ['.*_file$'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const config2: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3001',
      allowPatterns: [],
      denyPatterns: ['.*_database$'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy1 = new ProxyOrchestrator(config1, mockServer1 as any);
    const proxy2 = new ProxyOrchestrator(config2, mockServer2 as any);

    await proxy1.startup();
    await proxy2.startup();

    const tools1 = proxy1.getCachedTools();
    const tools2 = proxy2.getCachedTools();

    expect(tools1.map((t) => t.name).sort()).toEqual([
      'get_env',
      'list_dir',
      'query_database',
      'update_database',
    ]);

    expect(tools2.map((t) => t.name).sort()).toEqual([
      'get_env',
      'list_dir',
      'read_file',
      'write_file',
    ]);
  });

  it('should filter tools independently per instance', async () => {
    const mockServer1 = createMockServer(allTools);
    const mockServer2 = createMockServer(allTools);

    const config1: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: [],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const config2: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3001',
      allowPatterns: [],
      denyPatterns: ['.*'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy1 = new ProxyOrchestrator(config1, mockServer1 as any);
    const proxy2 = new ProxyOrchestrator(config2, mockServer2 as any);

    await proxy1.startup();
    await proxy2.startup();

    expect(proxy1.getCachedTools()).toHaveLength(6);
    expect(proxy2.getCachedTools()).toHaveLength(0);
  });

  it('should allow same tool in one proxy and deny in another', async () => {
    const mockServer1 = createMockServer(allTools);
    const mockServer2 = createMockServer(allTools);

    const config1: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3000',
      allowPatterns: [],
      denyPatterns: ['read_file'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const config2: HttpProxyConfig = {
      mode: 'http',
      upstreamUrl: 'http://localhost:3001',
      allowPatterns: [],
      denyPatterns: ['write_file'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy1 = new ProxyOrchestrator(config1, mockServer1 as any);
    const proxy2 = new ProxyOrchestrator(config2, mockServer2 as any);

    await proxy1.startup();
    await proxy2.startup();

    expect(proxy1.isToolAllowed('read_file')).toBe(false);
    expect(proxy1.isToolAllowed('write_file')).toBe(true);

    expect(proxy2.isToolAllowed('read_file')).toBe(true);
    expect(proxy2.isToolAllowed('write_file')).toBe(false);
  });
});
