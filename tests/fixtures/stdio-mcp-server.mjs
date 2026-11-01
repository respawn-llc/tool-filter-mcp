import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const tools = JSON.parse(process.argv[2] ?? '[]');
const server = new McpServer(
  {
    name: 'stdio-test-upstream',
    version: '1.0.0',
  },
  {
    capabilities: { tools: {} },
  }
);

for (const tool of tools) {
  server.registerTool(
    tool.name,
    { description: tool.description },
    async () => ({
      content: [
        {
          type: 'text',
          text: `stdio: ${tool.name}`,
        },
      ],
    })
  );
}

await server.connect(new StdioServerTransport());
