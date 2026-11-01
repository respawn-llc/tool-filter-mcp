import { describe, it, expect } from 'vitest';
import { ProxyOrchestrator } from '../../src/proxy.js';
import { HttpProxyConfig } from '../../src/types.js';
import { createMockServer } from '../fixtures/mock-mcp-server.js';
import { sampleTools } from '../fixtures/sample-tools.js';

describe('Regex Error Handling', () => {
  describe('Invalid regex patterns', () => {
    it('should reject invalid regex at startup', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['^[a-z'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Invalid regex pattern');
    });

    it('should reject invalid regex with clear error message', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['(abc'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);

      try {
        await proxy.startup();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid regex pattern');
        expect(error.message).toContain('(abc');
      }
    });

    it('should fail before connecting to upstream with invalid regex', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['[unclosed'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow();
      expect(proxy.isReady()).toBe(false);
    });
  });

  describe('ReDoS detection', () => {
    it('should reject unsafe regex patterns at startup', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['(a+)+'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Unsafe regex pattern');
    });

    it('should detect catastrophic backtracking patterns', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['(x+)*'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);

      try {
        await proxy.startup();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Unsafe regex pattern');
        expect(error.message).toContain('catastrophic backtracking');
      }
    });

    it('should reject nested quantifiers', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['(a*)*'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Unsafe regex pattern');
    });
  });

  describe('Multiple pattern validation', () => {
    it('should validate all patterns and fail on first invalid', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['^valid$', '^[invalid', '^also_valid$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Invalid regex pattern');
    });

    it('should validate all patterns and fail on first unsafe', async () => {
      const mockServer = createMockServer(sampleTools);
      const config: HttpProxyConfig = {
        mode: 'http',
        upstreamUrl: 'http://localhost:3000',
        allowPatterns: [],
        denyPatterns: ['^safe$', '(a+)+', '^also_safe$'],
        timeouts: {
          connection: 30000,
          toolList: 10000,
        },
      };

      const proxy = new ProxyOrchestrator(config, mockServer as any);
      await expect(proxy.startup()).rejects.toThrow('Unsafe regex pattern');
    });
  });
});
