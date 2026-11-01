import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ProxyOrchestrator } from './proxy.js';
import { implementationInfo } from './package-info.js';

export class MCPServer {
  private proxy: ProxyOrchestrator;

  constructor(proxy: ProxyOrchestrator) {
    this.proxy = proxy;
  }

  async handleListTools(): Promise<{ tools: Tool[] }> {
    const tools = this.proxy.getCachedTools();
    return {
      tools: tools.map(
        (t): Tool => ({
          name: t.name,
          description: t.description,
          inputSchema: {
            type: 'object',
            ...t.inputSchema,
          },
        })
      ),
    };
  }

  async handleCallTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content?: unknown[]; isError?: boolean }> {
    if (!this.proxy.isToolAllowed(name)) {
      throw {
        code: -32601,
        message: `Tool not found: ${name}`,
      };
    }

    const connection = this.proxy.getUpstreamConnection();
    const result = await connection.callTool(name, args || {});
    return result as { content?: unknown[]; isError?: boolean };
  }

  supportsResources(): boolean {
    return true;
  }

  supportsPrompts(): boolean {
    return true;
  }
}

export async function createMCPServer(proxy: ProxyOrchestrator): Promise<Server> {
  const server = new Server(
    implementationInfo,
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = proxy.getCachedTools();
    return {
      tools: tools.map(
        (t): Tool => ({
          name: t.name,
          description: t.description,
          inputSchema: {
            type: 'object',
            ...t.inputSchema,
          },
        })
      ),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!proxy.isToolAllowed(name)) {
      throw {
        code: -32601,
        message: `Tool not found: ${name}`,
      };
    }

    const connection = proxy.getUpstreamConnection();
    const result = await connection.callTool(name, args || {});
    return result as { content?: unknown[]; isError?: boolean };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
}
