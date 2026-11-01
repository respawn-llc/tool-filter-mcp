import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sseTransportCtorSpy = vi.hoisted(() => vi.fn());
const streamableTransportCtorSpy = vi.hoisted(() => vi.fn());

const clientConnectMock = vi.hoisted(() => vi.fn());

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  class MockSSEClientTransport {
    constructor(url: URL, options: Record<string, unknown>) {
      sseTransportCtorSpy(url, options);
    }

    close = vi.fn().mockResolvedValue(undefined);
  }

  return {
    SSEClientTransport: MockSSEClientTransport,
  };
});

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  class MockStreamableHTTPClientTransport {
    constructor(url: URL, options: Record<string, unknown>) {
      streamableTransportCtorSpy(url, options);
    }

    close = vi.fn().mockResolvedValue(undefined);
    terminateSession = vi.fn().mockResolvedValue(undefined);
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

describe('CLI header support', () => {
  beforeEach(() => {
    sseTransportCtorSpy.mockClear();
    streamableTransportCtorSpy.mockClear();
    clientConnectMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes configured headers to transports', async () => {
    clientConnectMock.mockImplementation(async (transport: Record<string, unknown>) => {
      if ('terminateSession' in transport) {
        throw new Error('Error POSTing to endpoint (HTTP 405): Not Allowed');
      }
    });

    const { createUpstreamClient } = await import('../../src/client.js');

    const headers = {
      Authorization: 'Bearer token',
      'X-Custom': 'value',
    };

    const upstreamClient = await createUpstreamClient('https://example.com/mcp', headers);

    await expect(upstreamClient.connect()).resolves.toBeUndefined();

    expect(streamableTransportCtorSpy).toHaveBeenCalledTimes(1);
    expect(streamableTransportCtorSpy).toHaveBeenCalledWith(new URL('https://example.com/mcp'), {
      fetch: expect.any(Function),
      requestInit: { headers },
    });

    expect(sseTransportCtorSpy).toHaveBeenCalledTimes(1);
    expect(sseTransportCtorSpy).toHaveBeenCalledWith(new URL('https://example.com/mcp'), {
      eventSourceInit: {
        headers,
        fetch: expect.any(Function),
      },
      requestInit: { headers },
      fetch: expect.any(Function),
    });

    expect(clientConnectMock).toHaveBeenCalledTimes(2);

    upstreamClient.disconnect();
  });
});
