import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/sse.js';
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { EventSourceInit } from 'eventsource';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { implementationInfo } from './package-info.js';

export interface WrappedClient {
  connect(): Promise<void>;
  listTools(): Promise<{ tools: Tool[] }>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  disconnect(): void;
  isConnected(): boolean;
}

function normalizeAllowHeader(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const methods = header
    .split(',')
    .map((method) => method.trim().toUpperCase())
    .filter((method) => method.length > 0);

  if (methods.length === 0) {
    return null;
  }

  return [...new Set(methods)].join(', ');
}

async function probeAllowedMethods(
  upstreamUrl: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<string | null> {
  const methodsToTry: Array<RequestInit['method']> = ['OPTIONS', 'HEAD'];
  const headerEntries = Object.entries(headers ?? {});

  for (const method of methodsToTry) {
    try {
      const requestInit: RequestInit = { method };

      if (headerEntries.length > 0) {
        const requestHeaders = new Headers();
        for (const [key, value] of headerEntries) {
          requestHeaders.set(key, value);
        }
        requestInit.headers = requestHeaders;
      }

      const response = await fetchImpl(upstreamUrl, requestInit);
      const allowHeader = normalizeAllowHeader(
        response.headers && typeof response.headers.get === 'function'
          ? response.headers.get('allow')
          : null
      );

      if (allowHeader) {
        return allowHeader;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isMethodNotAllowedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  if (typeof code === 'number') {
    return code === 405;
  }

  if (typeof code === 'string') {
    const parsed = Number(code);
    return Number.isInteger(parsed) && parsed === 405;
  }

  return false;
}

export async function createUpstreamClient(
  upstreamUrl: string,
  headers?: Record<string, string>
): Promise<WrappedClient> {
  const allowHeaderRef: { value: string | null } = { value: null };
  const baseFetch: typeof fetch = fetch;
  const upstreamTarget = new URL(upstreamUrl);
  const safeHeaders = headers ?? {};

  const fetchWithAllowCapture: typeof fetch = async (input, init) => {
    const response = await baseFetch(input, init);

    if (response && typeof response === 'object' && 'status' in response && response.status === 405) {
      const headers =
        'headers' in response && response.headers && typeof (response.headers as Headers).get === 'function'
          ? (response.headers as Headers)
          : undefined;
      const allowHeader = headers ? headers.get('allow') : null;
      allowHeaderRef.value = normalizeAllowHeader(allowHeader);
    }

    return response;
  };

  const eventSourceInit: EventSourceInit & {
    headers?: Record<string, string>;
    fetch: typeof fetch;
  } = {
    fetch: fetchWithAllowCapture,
  };

  const requestInit: RequestInit | undefined = Object.keys(safeHeaders).length > 0
    ? { headers: safeHeaders }
    : undefined;

  if (Object.keys(safeHeaders).length > 0) {
    eventSourceInit.headers = safeHeaders;
  }

  const transportOptions: SSEClientTransportOptions = {
    eventSourceInit,
    fetch: fetchWithAllowCapture,
    ...(requestInit ? { requestInit } : {}),
  };
  const streamableOptions: StreamableHTTPClientTransportOptions = {
    fetch: fetchWithAllowCapture,
    ...(requestInit ? { requestInit } : {}),
  };

  const determineTransportOrder = (url: URL): Array<'streamable' | 'sse'> => {
    const rawPath = url.pathname.toLowerCase();
    const normalizedPath = rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
    if (normalizedPath.endsWith('/sse')) {
      return ['sse', 'streamable'];
    }
    if (normalizedPath.endsWith('/mcp')) {
      return ['streamable', 'sse'];
    }
    return ['streamable', 'sse'];
  };

  const transportOrder = determineTransportOrder(upstreamTarget);
  const createClient = (): Client =>
    new Client(
      implementationInfo,
      {
        capabilities: {},
      }
    );

  let client: Client = createClient();
  let activeTransport: SSEClientTransport | StreamableHTTPClientTransport | null = null;
  let connected = false;

  const closeTransport = async (
    transport: SSEClientTransport | StreamableHTTPClientTransport
  ): Promise<void> => {
    try {
      await transport.close();
    } catch {}
  };

  const shouldFallbackToSse = (error: unknown): boolean => {
    if (isMethodNotAllowedError(error)) {
      return true;
    }

    if (error instanceof Error && typeof error.message === 'string') {
      return /HTTP\s+40[45]/.test(error.message);
    }

    return false;
  };

  return {
    async connect(): Promise<void> {
      activeTransport = null;
      connected = false;

      for (let index = 0; index < transportOrder.length; index += 1) {
        const attempt = transportOrder[index];

        allowHeaderRef.value = null;
        client = createClient();

        const transport =
          attempt === 'streamable'
            ? new StreamableHTTPClientTransport(new URL(upstreamUrl), streamableOptions)
            : new SSEClientTransport(new URL(upstreamUrl), transportOptions);

        try {
          await client.connect(transport);
          activeTransport = transport;
          connected = true;
          return;
        } catch (error) {
          await closeTransport(transport);
          activeTransport = null;
          connected = false;

          if (attempt === 'streamable') {
            const hasSseRemaining = transportOrder.slice(index + 1).includes('sse');

            if (hasSseRemaining && shouldFallbackToSse(error)) {
              allowHeaderRef.value = null;
              continue;
            }

            if (isMethodNotAllowedError(error)) {
              const allowedMethods =
                allowHeaderRef.value ??
                (await probeAllowedMethods(upstreamUrl, safeHeaders, fetchWithAllowCapture));
              const message = allowedMethods
                ? `Upstream responded with HTTP 405 Method Not Allowed. Supported methods: ${allowedMethods}.`
                : 'Upstream responded with HTTP 405 Method Not Allowed and did not provide an Allow header.';

              throw new Error(message, { cause: error });
            }

            throw error;
          }

          const hasStreamableRemaining = transportOrder.slice(index + 1).includes('streamable');

          if (hasStreamableRemaining) {
            continue;
          }

          if (isMethodNotAllowedError(error)) {
            const allowedMethods =
              allowHeaderRef.value ??
              (await probeAllowedMethods(upstreamUrl, safeHeaders, fetchWithAllowCapture));
            const message = allowedMethods
              ? `Upstream responded with HTTP 405 Method Not Allowed. Supported methods: ${allowedMethods}.`
              : 'Upstream responded with HTTP 405 Method Not Allowed and did not provide an Allow header.';

            throw new Error(message, { cause: error });
          }

          throw error;
        }
      }
    },
    async listTools(): Promise<{ tools: Tool[] }> {
      const result = await client.listTools();
      return result as { tools: Tool[] };
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      return await client.callTool({ name, arguments: args });
    },
    disconnect(): void {
      if (activeTransport instanceof StreamableHTTPClientTransport) {
        void activeTransport.terminateSession().catch(() => undefined);
      }

      void client.close();
      connected = false;
      activeTransport = null;
    },
    isConnected(): boolean {
      return connected;
    },
  };
}

export async function createStdioUpstreamClient(
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<WrappedClient> {
  const client = new Client(
    implementationInfo,
    {
      capabilities: {},
    }
  );

  let transport: StdioClientTransport | null = null;
  let connected = false;

  return {
    async connect(): Promise<void> {
      transport = new StdioClientTransport({
        command,
        args,
        env,
      });

      await client.connect(transport);
      connected = true;
    },

    async listTools(): Promise<{ tools: Tool[] }> {
      const result = await client.listTools();
      return result as { tools: Tool[] };
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      return await client.callTool({ name, arguments: args });
    },

    disconnect(): void {
      void client.close();
      connected = false;
      transport = null;
    },

    isConnected(): boolean {
      return connected;
    },
  };
}
