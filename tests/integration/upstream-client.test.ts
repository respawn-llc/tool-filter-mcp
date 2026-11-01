import { describe, it, expect } from 'vitest';
import { UpstreamConnection } from '../../src/upstream-client.js';
import {
  createMockServer,
  createFailingMockServer,
  createSlowMockServer,
} from '../fixtures/mock-mcp-server.js';
import { sampleTools } from '../fixtures/sample-tools.js';

describe('UpstreamConnection', () => {
  describe('connect', () => {
    it('should connect successfully to upstream server', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();

      expect(connection.isConnected()).toBe(true);
    });

    it('should fail to connect to non-existent server', async () => {
      const mockServer = createFailingMockServer();
      const connection = new UpstreamConnection('http://localhost:9999', mockServer as any);

      await expect(connection.connect()).rejects.toThrow('Connection refused');
      expect(connection.isConnected()).toBe(false);
    });

    it('should timeout after 30 seconds', async () => {
      const mockServer = createSlowMockServer(sampleTools, 31000);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any, {
        connection: 30000,
        toolList: 10000,
      });

      await expect(connection.connect()).rejects.toThrow('timeout');
      expect(connection.isConnected()).toBe(false);
    }, 35000);

    it('should not allow multiple connections', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();
      await expect(connection.connect()).rejects.toThrow('Already connected');
    });
  });

  describe('fetchTools', () => {
    it('should fetch tools from upstream server', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();
      const tools = await connection.fetchTools();

      expect(tools).toHaveLength(4);
      expect(tools).toEqual(sampleTools);
    });

    it('should fail when not connected', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await expect(connection.fetchTools()).rejects.toThrow('Not connected');
    });

    it('should timeout after 10 seconds', async () => {
      const mockServer = createSlowMockServer(sampleTools, 5000);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any, {
        connection: 30000,
        toolList: 100,
      });

      await connection.connect();
      await expect(connection.fetchTools()).rejects.toThrow('timeout');
    }, 6000);

    it('should cache tools after first fetch', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();
      const tools1 = await connection.fetchTools();
      const tools2 = await connection.fetchTools();

      expect(tools1).toBe(tools2);
    });
  });

  describe('callTool', () => {
    it('should forward tool call to upstream server', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();
      const result = await connection.callTool('read_file', { path: '/test.txt' });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('content');
    });

    it('should fail when not connected', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await expect(connection.callTool('read_file', {})).rejects.toThrow('Not connected');
    });

    it('should propagate upstream errors', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();
      await expect(connection.callTool('nonexistent_tool', {})).rejects.toThrow('Tool not found');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from upstream server', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      expect(() => connection.disconnect()).not.toThrow();
    });
  });

  describe('connection loss', () => {
    it('should detect connection loss', async () => {
      const mockServer = createMockServer(sampleTools);
      const connection = new UpstreamConnection('http://localhost:3000', mockServer as any);

      await connection.connect();
      mockServer.disconnect();

      await expect(connection.fetchTools()).rejects.toThrow('Not connected');
    });
  });
});
