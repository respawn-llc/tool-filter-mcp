import { ProxyConfig, FilteredTool } from './types.js';
import { UpstreamConnection, MCPClient } from './upstream-client.js';
import { applyFilters } from './filter.js';
import { formatCommandDisplay } from './utils/command-formatter.js';

export class ProxyOrchestrator {
  private config: ProxyConfig;
  private upstreamConnection: UpstreamConnection;
  private filteredTools: FilteredTool[] | null = null;
  private ready: boolean = false;

  constructor(config: ProxyConfig, client: MCPClient) {
    this.config = config;

    // Determine identifier string based on config mode
    const identifier =
      config.mode === 'http'
        ? config.upstreamUrl
        : formatCommandDisplay(config.upstreamCommand, config.upstreamArgs);

    this.upstreamConnection = new UpstreamConnection(identifier, client, config.timeouts);
  }

  async startup(): Promise<void> {
    await this.upstreamConnection.connect();

    const tools = await this.upstreamConnection.fetchTools();

    const filterResult = applyFilters(tools, {
      allowPatterns: this.config.allowPatterns,
      denyPatterns: this.config.denyPatterns,
    });

    this.filteredTools = filterResult.allowed;
    this.ready = true;
  }

  getCachedTools(): FilteredTool[] {
    if (!this.ready || this.filteredTools === null) {
      throw new Error('Proxy not ready');
    }

    return [...this.filteredTools];
  }

  isToolAllowed(name: string): boolean {
    if (!this.ready || this.filteredTools === null) {
      throw new Error('Proxy not ready');
    }

    return this.filteredTools.some((tool) => tool.name === name);
  }

  isReady(): boolean {
    return this.ready;
  }

  getUpstreamConnection(): UpstreamConnection {
    return this.upstreamConnection;
  }

  shutdown(): void {
    this.upstreamConnection.disconnect();
    this.ready = false;
  }
}
