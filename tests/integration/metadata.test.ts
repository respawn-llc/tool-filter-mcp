import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { describe, expect, it } from 'vitest';
import { createUpstreamClient } from '../../src/client.js';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);
const expectedInfo = { name: 'tool-filter-mcp', version };

describe('MCP implementation metadata', () => {
  it('reports the package version to an HTTP upstream', async () => {
    const server = new Server({ name: 'metadata-upstream', version: '1.0.0' });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID });
    await server.connect(transport);

    const httpServer = createServer((request, response) => {
      void transport.handleRequest(request, response);
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected an HTTP listening port');
    }

    const client = await createUpstreamClient(`http://127.0.0.1:${address.port}/mcp`);
    try {
      await client.connect();
      expect(server.getClientVersion()).toEqual(expectedInfo);
    } finally {
      client.disconnect();
      await server.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it('reports the package version on both sides of a stdio proxy', async () => {
    const upstreamScript = `
      import { Server } from '@modelcontextprotocol/sdk/server/index.js';
      import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
      import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
      const server = new Server(
        { name: 'metadata-upstream', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [{ name: 'client_info', inputSchema: { type: 'object' } }]
      }));
      server.setRequestHandler(CallToolRequestSchema, async () => ({
        content: [{ type: 'text', text: JSON.stringify(server.getClientVersion()) }]
      }));
      await server.connect(new StdioServerTransport());
    `;
    const client = new Client({ name: 'metadata-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        'dist/index.js',
        '--upstream-stdio',
        '--',
        process.execPath,
        '--input-type=module',
        '--eval',
        upstreamScript,
      ],
      stderr: 'pipe',
    });
    let diagnostics = '';
    transport.stderr?.on('data', (chunk) => {
      diagnostics += chunk.toString();
    });

    try {
      await client.connect(transport);
      expect(client.getServerVersion()).toEqual(expectedInfo);
      const result = await client.callTool({ name: 'client_info' });
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedInfo) }]);
    } catch (error) {
      throw new Error(`Stdio proxy metadata check failed.\n${diagnostics}`, { cause: error });
    } finally {
      await client.close();
    }
  });
});
