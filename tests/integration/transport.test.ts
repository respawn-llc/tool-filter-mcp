import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express, { Express } from 'express';
import { Server as HttpServer } from 'http';
import { spawn } from 'child_process';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { sampleTools } from '../fixtures/sample-tools.js';

const STREAMABLE_HTTP_PORT = 64400;
const SSE_PORT = 64401;
const upstreamCalls: string[] = [];

function registerSampleTools(server: McpServer, transportName: string): void {
  for (const tool of sampleTools) {
    server.registerTool(tool.name, { description: tool.description }, async () => {
      upstreamCalls.push(tool.name);
      return {
        content: [
          {
            type: 'text',
            text: `${transportName}: ${tool.name}`,
          },
        ],
      };
    });
  }
}

async function startStreamableHttpServer(
  port: number
): Promise<{ app: Express; server: HttpServer }> {
  const app = express();
  app.use(express.json());
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  app.use(async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const existingTransport = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;

    if (existingTransport) {
      await existingTransport.handleRequest(req, res, req.body);
      return;
    }

    const mcpServer = new McpServer(
      {
        name: 'test-streamable-http-server',
        version: '1.0.0',
      },
      {
        capabilities: { tools: {} },
      }
    );

    registerSampleTools(mcpServer, 'Streamable HTTP');

    let transport: StreamableHTTPServerTransport;
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const server = await new Promise<HttpServer>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  return { app, server };
}

const cliPath = join(process.cwd(), 'dist', 'index.js');
const stdioServerPath = join(process.cwd(), 'tests', 'fixtures', 'stdio-mcp-server.mjs');

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function runCli(args: string[]): Promise<CliResult> {
  const process = spawn(globalThis.process.execPath, [cliPath, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => process.kill('SIGKILL'), 10000);

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    process.once('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode });
    });
  });
}

async function withProxyClient<T>(args: string[], run: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: globalThis.process.execPath,
    args: [cliPath, ...args],
    stderr: 'pipe',
  });
  transport.stderr?.pipe(globalThis.process.stderr);

  const client = new Client(
    {
      name: 'allow-list-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    return await run(client);
  } finally {
    await client.close();
  }
}

async function startSseServer(port: number): Promise<{ app: Express; server: HttpServer }> {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, SSEServerTransport>();

  app.get('/sse', async (_req, res) => {
    const mcpServer = new McpServer(
      {
        name: 'test-sse-server',
        version: '1.0.0',
      },
      {
        capabilities: { tools: {} },
      }
    );

    registerSampleTools(mcpServer, 'SSE');

    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    transport.onclose = () => {
      transports.delete(sessionId);
    };

    await mcpServer.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send('Missing sessionId');
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send('Session not found');
      return;
    }

    await transport.handlePostMessage(req, res, req.body);
  });

  const server = await new Promise<HttpServer>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  return { app, server };
}

describe('Transport compatibility', () => {
  let streamableHttpServer: HttpServer;
  let sseServer: HttpServer;

  beforeAll(async () => {
    const streamableResult = await startStreamableHttpServer(STREAMABLE_HTTP_PORT);
    streamableHttpServer = streamableResult.server;

    const sseResult = await startSseServer(SSE_PORT);
    sseServer = sseResult.server;
  }, 15000);

  beforeEach(() => {
    upstreamCalls.length = 0;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      streamableHttpServer.close(() => resolve());
    });

    await new Promise<void>((resolve) => {
      sseServer.close(() => resolve());
    });
  });

  it('should format filtered list previews as table, JSON, and names', async () => {
    for (const format of ['table', 'json', 'names'] as const) {
      const result = await runCli([
        '--upstream',
        `http://localhost:${STREAMABLE_HTTP_PORT}/mcp`,
        '--allow',
        '^read_file$',
        '--list-tools',
        '--format',
        format,
      ]);

      expect(result.exitCode, `stdout=${result.stdout}\nstderr=${result.stderr}`).toBe(0);

      if (format === 'table') {
        expect(result.stdout).toContain('Available tools (1 total)');
        expect(result.stdout).toContain('read_file');
      } else if (format === 'json') {
        expect(JSON.parse(result.stdout).map((tool: { name: string }) => tool.name)).toEqual([
          'read_file',
        ]);
      } else {
        expect(result.stdout.trim()).toBe('read_file');
      }
    }
  }, 30000);

  it('should preview filtered tools from SSE upstreams', async () => {
    const result = await runCli([
      '--upstream',
      `http://localhost:${SSE_PORT}/sse`,
      '--allow',
      '^read_file$,^write_file$',
      '--deny',
      '^write_file$',
      '--list-tools',
      '--format',
      'names',
    ]);

    expect(result.exitCode, `stdout=${result.stdout}\nstderr=${result.stderr}`).toBe(0);
    expect(result.stdout.trim()).toBe('read_file');
  });

  it('should match Streamable HTTP preview, discovery, and call filtering', async () => {
    const upstreamUrl = `http://localhost:${STREAMABLE_HTTP_PORT}/mcp`;
    const filterArgs = [
      '--upstream',
      upstreamUrl,
      '--allow',
      '^read_file$,^write_file$',
      '--deny',
      '^write_file$',
    ];
    const preview = await runCli([...filterArgs, '--list-tools', '--format', 'names']);

    expect(preview.exitCode, `stdout=${preview.stdout}\nstderr=${preview.stderr}`).toBe(0);
    expect(preview.stdout.trim()).toBe('read_file');

    await withProxyClient(filterArgs, async (client) => {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(preview.stdout.trim().split(','));

      const result = await client.callTool({ name: 'read_file', arguments: {} });
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Streamable HTTP: read_file',
        },
      ]);

      await expect(client.callTool({ name: 'write_file', arguments: {} })).rejects.toMatchObject({
        code: -32601,
      });
      await expect(client.callTool({ name: 'list_dir', arguments: {} })).rejects.toMatchObject({
        code: -32601,
      });

      expect(upstreamCalls).toEqual(['read_file']);
    });
  }, 30000);

  it('should use allow filters for SSE proxy discovery and calls', async () => {
    const filterArgs = ['--upstream', `http://localhost:${SSE_PORT}/sse`, '--allow', '^get_env$'];

    await withProxyClient(filterArgs, async (client) => {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(['get_env']);

      const result = await client.callTool({ name: 'get_env', arguments: {} });
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'SSE: get_env',
        },
      ]);
      expect(upstreamCalls).toEqual(['get_env']);
    });
  }, 30000);

  it('should preview and proxy-filter stdio upstream tools', async () => {
    const filterArgs = [
      '--upstream-stdio',
      '--allow',
      '^read_file$,^write_file$',
      '--deny',
      '^write_file$',
    ];
    const upstreamArgs = [
      '--',
      globalThis.process.execPath,
      stdioServerPath,
      JSON.stringify(sampleTools),
    ];
    const preview = await runCli([
      ...filterArgs,
      '--list-tools',
      '--format',
      'names',
      ...upstreamArgs,
    ]);

    expect(preview.exitCode, `stdout=${preview.stdout}\nstderr=${preview.stderr}`).toBe(0);
    expect(preview.stdout.trim()).toBe('read_file');

    await withProxyClient([...filterArgs, ...upstreamArgs], async (client) => {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(preview.stdout.trim().split(','));

      const result = await client.callTool({ name: 'read_file', arguments: {} });
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'stdio: read_file',
        },
      ]);

      await expect(client.callTool({ name: 'write_file', arguments: {} })).rejects.toMatchObject({
        code: -32601,
      });
    });
  }, 30000);

  it('should keep no-match allow filters empty in preview and proxy discovery', async () => {
    const filterArgs = [
      '--upstream',
      `http://localhost:${STREAMABLE_HTTP_PORT}/mcp`,
      '--allow',
      '^no_such_tool$',
    ];
    const preview = await runCli([...filterArgs, '--list-tools', '--format', 'json']);

    expect(preview.exitCode, `stdout=${preview.stdout}\nstderr=${preview.stderr}`).toBe(0);
    expect(JSON.parse(preview.stdout)).toEqual([]);

    await withProxyClient(filterArgs, async (client) => {
      const { tools } = await client.listTools();
      expect(tools).toEqual([]);
      await expect(client.callTool({ name: 'read_file', arguments: {} })).rejects.toMatchObject({
        code: -32601,
      });
      expect(upstreamCalls).toEqual([]);
    });
  }, 30000);

  it('should fail list previews for invalid and unsafe allow regexes', async () => {
    const upstreamUrl = `http://localhost:${STREAMABLE_HTTP_PORT}/mcp`;

    for (const [pattern, errorMessage] of [
      ['^[a-z', 'Invalid regex pattern'],
      ['(a+)+', 'Unsafe regex pattern'],
    ]) {
      const result = await runCli([
        '--upstream',
        upstreamUrl,
        '--allow',
        pattern,
        '--list-tools',
        '--format',
        'json',
      ]);

      expect(result.exitCode, `stdout=${result.stdout}\nstderr=${result.stderr}`).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(errorMessage);
    }
  }, 30000);
});
