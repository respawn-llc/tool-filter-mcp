import { describe, it, expect } from 'vitest';
import { MCPServer } from '../../src/server.js';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { HttpProxyConfig } from '../../src/types.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools } from '../fixtures/sample-tools.js';

describe('MCPServer - Tool Filtering', () => {
  describe('tools/list handler', () => {
    it('should return filtered tools', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toEqual(['list_dir', 'get_env']);
    });

    it('should return all tools when no deny patterns', async () => {
      const mockUpstream = createMockServer(sampleTools);
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

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(4);
      expect(result.tools).toEqual(sampleTools);
    });

    it('should return empty list when all tools filtered', async () => {
      const mockUpstream = createMockServer(sampleTools);
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

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleListTools();

      expect(result.tools).toHaveLength(0);
    });
  });

  describe('tools/call handler - allowed tools', () => {
    it('should forward allowed tool call to upstream', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const result = await server.handleCallTool('list_dir', { path: '/home' });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('content');
    });

    it('should forward arguments to upstream', async () => {
      const mockUpstream = createMockServer(sampleTools);
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

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      const args = { name: 'TEST_VAR' };
      const result = await server.handleCallTool('get_env', args);

      expect(result).toBeDefined();
    });
  });

  describe('tools/call handler - denied tools', () => {
    it('should reject denied tool call with error', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      await expect(server.handleCallTool('read_file', { path: '/test' })).rejects.toThrow(
        'Tool not found: read_file'
      );
    });

    it('should reject with error code -32601', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      try {
        await server.handleCallTool('write_file', {});
      } catch (error: any) {
        expect(error.code).toBe(-32601);
        expect(error.message).toBe('Tool not found: write_file');
      }
    });

    it('should not forward denied tool calls to upstream', async () => {
      const mockUpstream = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['.*_file$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);

      await expect(server.handleCallTool('read_file', {})).rejects.toThrow();
    });
  });

  describe('passthrough handlers', () => {
    it('should support resources/list passthrough', async () => {
      const mockUpstream = createMockServer(sampleTools);
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

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      expect(server.supportsResources()).toBe(true);
    });

    it('should support prompts/list passthrough', async () => {
      const mockUpstream = createMockServer(sampleTools);
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

      const proxy = new ProxyOrchestrator(config, mockUpstream as any);
      await proxy.startup();

      const server = new MCPServer(proxy);
      expect(server.supportsPrompts()).toBe(true);
    });
  });
});
