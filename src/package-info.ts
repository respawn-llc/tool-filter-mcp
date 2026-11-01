import { readFileSync } from 'node:fs';
import type { Implementation } from '@modelcontextprotocol/sdk/types.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

export const implementationInfo: Implementation = {
  name: 'tool-filter-mcp',
  version: packageJson.version,
};
