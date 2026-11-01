import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const clientConnectMock = vi.hoisted(() => vi.fn());

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  class MockSSEClientTransport {
    url: URL;
    options: Record<string, unknown>;

    constructor(url: URL, options?: Record<string, unknown>) {
      this.url = url;
      this.options = options ?? {};
    }

    async close(): Promise<void> {
      return Promise.resolve();
    }
  }

  return {
    SSEClientTransport: MockSSEClientTransport,
  };
});

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  class MockStreamableHTTPClientTransport {
    url: URL;
    options: Record<string, unknown>;

    constructor(url: URL, options?: Record<string, unknown>) {
      this.url = url;
      this.options = options ?? {};
    }

    async close(): Promise<void> {
      return Promise.resolve();
    }

    async terminateSession(): Promise<void> {
      return Promise.resolve();
    }
  }

  return {
    StreamableHTTPClientTransport: MockStreamableHTTPClientTransport,
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  class MockClient {
    connect = clientConnectMock;
    listTools = vi.fn();
    callTool = vi.fn();
    close = vi.fn();
  }

  return {
    Client: MockClient,
  };
});

describe('createUpstreamClient 405 handling', () => {
  beforeEach(() => {
    clientConnectMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces Allow header information when upstream responds with 405', async () => {
    const allowHeader = 'POST, OPTIONS';

    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 405,
          headers: {
            Allow: allowHeader,
          },
        })
    );

    vi.stubGlobal('fetch', fetchMock);

    clientConnectMock.mockImplementation(
      async (transport: { options?: Record<string, unknown> }) => {
        if ('terminateSession' in transport) {
          throw new Error('Error POSTing to endpoint (HTTP 405): Not Allowed');
        }

        const eventSourceInit = transport.options?.eventSourceInit as {
          fetch?: typeof fetch;
        };

        if (eventSourceInit?.fetch) {
          await eventSourceInit.fetch(new URL('https://example.com/mcp'), {});
        }

        const error = new Error('SSE error: Non-200 status code (405)');
        (error as { code?: number }).code = 405;
        throw error;
      }
    );

    const { createUpstreamClient } = await import('../../src/client.js');
    const upstreamClient = await createUpstreamClient('https://example.com/mcp', {});

    await expect(upstreamClient.connect()).rejects.toThrow(
      'Upstream responded with HTTP 405 Method Not Allowed. Supported methods: POST, OPTIONS.'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('probes upstream for supported methods when Allow header is missing', async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const init = args[1];
      const method = init?.method ?? 'GET';

      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            Allow: 'POST, OPTIONS',
          },
        });
      }

      return new Response(null, {
        status: 405,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    clientConnectMock.mockImplementation(
      async (transport: { options?: Record<string, unknown> }) => {
        if ('terminateSession' in transport) {
          throw new Error('Error POSTing to endpoint (HTTP 405): Not Allowed');
        }

        const eventSourceInit = transport.options?.eventSourceInit as {
          fetch?: typeof fetch;
        };

        if (eventSourceInit?.fetch) {
          await eventSourceInit.fetch(new URL('https://example.com/mcp'), {});
        }

        const error = new Error('SSE error: Non-200 status code (405)');
        (error as { code?: number }).code = 405;
        throw error;
      }
    );

    const { createUpstreamClient } = await import('../../src/client.js');
    const upstreamClient = await createUpstreamClient('https://example.com/mcp', {
      Authorization: 'Bearer token',
    });

    await expect(upstreamClient.connect()).rejects.toThrow(
      'Upstream responded with HTTP 405 Method Not Allowed. Supported methods: POST, OPTIONS.'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/mcp',
      expect.objectContaining({
        method: 'OPTIONS',
      })
    );
  });

  it('uses streamable HTTP transport when upstream supports it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    clientConnectMock.mockImplementation(
      async (transport: { options?: Record<string, unknown> }) => {
        if ('terminateSession' in transport) {
          return;
        }

        throw new Error('SSE should not be attempted');
      }
    );

    const { createUpstreamClient } = await import('../../src/client.js');
    const upstreamClient = await createUpstreamClient('https://example.com/mcp', {});

    await expect(upstreamClient.connect()).resolves.toBeUndefined();

    expect(clientConnectMock).toHaveBeenCalledTimes(1);

    upstreamClient.disconnect();
  });

  it('prefers SSE transport when upstream path hints /sse', async () => {
    vi.stubGlobal('fetch', vi.fn());

    clientConnectMock.mockImplementation(async (transport: Record<string, unknown>) => {
      expect('terminateSession' in transport).toBe(false);
    });

    const { createUpstreamClient } = await import('../../src/client.js');
    const upstreamClient = await createUpstreamClient('https://example.com/sse', {});

    await expect(upstreamClient.connect()).resolves.toBeUndefined();

    expect(clientConnectMock).toHaveBeenCalledTimes(1);

    upstreamClient.disconnect();
  });
});
