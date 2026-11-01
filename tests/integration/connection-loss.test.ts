import { describe, it, expect } from 'vitest';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { HttpProxyConfig } from '../../src/types.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools } from '../fixtures/sample-tools.js';

describe('Connection Loss', () => {
  it('should detect upstream connection loss', async () => {
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

    expect(proxy.isReady()).toBe(true);

    mockServer.disconnect();

    const connection = proxy.getUpstreamConnection();
    expect(connection.isConnected()).toBe(false);
  });

  it('should fail tool calls after connection loss', async () => {
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

    mockServer.disconnect();

    const connection = proxy.getUpstreamConnection();
    await expect(connection.callTool('read_file', {})).rejects.toThrow();
  });

  it('should maintain ready state after connection loss', async () => {
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

    mockServer.disconnect();

    expect(proxy.isReady()).toBe(true);
    expect(proxy.getCachedTools()).toHaveLength(4);
  });
});
