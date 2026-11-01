import { describe, it, expect } from 'vitest';
import { createStdioUpstreamClient } from '../../src/client.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools } from '../fixtures/sample-tools.js';
import { StdioProxyConfig } from '../../src/types.js';
import { ProxyOrchestrator } from '../../src/proxy.js';

describe('Stdio transport integration', () => {
  it('should create stdio upstream client with correct interface', async () => {
    // This test verifies the client interface without actually spawning a process
    const mockCommand = 'echo';
    const mockArgs = ['test'];

    // Create client but don't connect (to avoid spawning process)
    const client = await createStdioUpstreamClient(mockCommand, mockArgs);

    expect(client).toBeDefined();
    expect(client.connect).toBeDefined();
    expect(client.listTools).toBeDefined();
    expect(client.callTool).toBeDefined();
    expect(client.disconnect).toBeDefined();
    expect(client.isConnected).toBeDefined();
    expect(typeof client.connect).toBe('function');
    expect(typeof client.listTools).toBe('function');
    expect(typeof client.callTool).toBe('function');
    expect(typeof client.disconnect).toBe('function');
    expect(typeof client.isConnected).toBe('function');
  });

  it('should create ProxyOrchestrator with stdio config', async () => {
    const config: StdioProxyConfig = {
      mode: 'stdio',
      upstreamCommand: 'node',
      upstreamArgs: ['server.js'],
      allowPatterns: [],
      denyPatterns: ['dangerous_.*'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const mockClient = createMockServer(sampleTools);
    const proxy = new ProxyOrchestrator(config, mockClient);

    expect(proxy).toBeDefined();
    expect(proxy.isReady()).toBe(false);

    await proxy.startup();

    expect(proxy.isReady()).toBe(true);
    const tools = proxy.getCachedTools();
    expect(tools.length).toBeGreaterThan(0);

    proxy.shutdown();
  });

  it('should filter tools correctly with stdio config', async () => {
    const config: StdioProxyConfig = {
      mode: 'stdio',
      upstreamCommand: 'npx',
      upstreamArgs: ['some-mcp-server'],
      allowPatterns: [],
      denyPatterns: ['^get_.*'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const mockClient = createMockServer(sampleTools);
    const proxy = new ProxyOrchestrator(config, mockClient);

    await proxy.startup();

    const tools = proxy.getCachedTools();

    // Verify tools starting with 'get_' are filtered out
    const hasGetTools = tools.some((tool) => tool.name.startsWith('get_'));
    expect(hasGetTools).toBe(false);

    // Verify other tools are still present
    expect(tools.length).toBeGreaterThan(0);

    proxy.shutdown();
  });

  it('should apply allow and deny patterns to stdio tools', async () => {
    const config: StdioProxyConfig = {
      mode: 'stdio',
      upstreamCommand: 'npx',
      upstreamArgs: ['some-mcp-server'],
      allowPatterns: ['^read_', '^write_'],
      denyPatterns: ['^write_'],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const proxy = new ProxyOrchestrator(config, createMockServer(sampleTools));
    await proxy.startup();

    expect(proxy.getCachedTools().map((tool) => tool.name)).toEqual(['read_file']);
    expect(proxy.isToolAllowed('read_file')).toBe(true);
    expect(proxy.isToolAllowed('write_file')).toBe(false);

    proxy.shutdown();
  });

  it('should handle multiple args in stdio config', async () => {
    const config: StdioProxyConfig = {
      mode: 'stdio',
      upstreamCommand: 'node',
      upstreamArgs: ['server.js', '--port=3000', '--config=test.json'],
      allowPatterns: [],
      denyPatterns: [],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const mockClient = createMockServer(sampleTools);
    const proxy = new ProxyOrchestrator(config, mockClient);

    await proxy.startup();

    expect(proxy.isReady()).toBe(true);
    const tools = proxy.getCachedTools();
    expect(tools.length).toBe(sampleTools.length);

    proxy.shutdown();
  });

  it('should not accept headers in stdio config', () => {
    // TypeScript should prevent this at compile time
    // This test verifies the type system works correctly
    const config: StdioProxyConfig = {
      mode: 'stdio',
      upstreamCommand: 'node',
      upstreamArgs: [],
      allowPatterns: [],
      denyPatterns: [],
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
      // @ts-expect-error headers should not be allowed in stdio config
      headers: { Authorization: 'Bearer token' },
    };

    expect(config.mode).toBe('stdio');
  });

  it('should accept env in stdio config', async () => {
    const config: StdioProxyConfig = {
      mode: 'stdio',
      upstreamCommand: 'node',
      upstreamArgs: ['server.js'],
      allowPatterns: [],
      denyPatterns: [],
      env: {
        API_KEY: 'secret123',
        DEBUG: 'true',
        PORT: '3000',
      },
      timeouts: {
        connection: 30000,
        toolList: 10000,
      },
    };

    const mockClient = createMockServer(sampleTools);
    const proxy = new ProxyOrchestrator(config, mockClient);

    await proxy.startup();

    expect(proxy.isReady()).toBe(true);
    expect(config.env).toEqual({
      API_KEY: 'secret123',
      DEBUG: 'true',
      PORT: '3000',
    });

    proxy.shutdown();
  });
});
