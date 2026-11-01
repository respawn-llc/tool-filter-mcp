export interface ParsedHeader {
  name: string;
  value: string;
}

export class HeaderParseError extends Error {
  constructor(
    message: string,
    public readonly header: string
  ) {
    super(message);
    this.name = 'HeaderParseError';
  }
}

function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/gi, (_match, braced, simple) => {
    const varName = braced || simple;
    const envValue = process.env[varName];

    if (envValue === undefined) {
      console.error(`Warning: Environment variable ${varName} is not defined, using empty string`);
      return '';
    }

    return envValue;
  });
}

export function parseHeaders(headerStrings: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  const seen = new Set<string>();

  for (const headerStr of headerStrings) {
    const colonIndex = headerStr.indexOf(':');

    if (colonIndex === -1) {
      throw new HeaderParseError('Header must be in "Name: Value" format', headerStr);
    }

    const name = headerStr.slice(0, colonIndex).trim();
    const value = headerStr.slice(colonIndex + 1).trim();

    if (!name) {
      throw new HeaderParseError('Header name cannot be empty', headerStr);
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      throw new HeaderParseError('Header name contains invalid characters', headerStr);
    }

    const nameLower = name.toLowerCase();
    if (seen.has(nameLower)) {
      console.error(`Warning: Duplicate header "${name}", using last value`);
    }
    seen.add(nameLower);

    headers[name] = expandEnvVars(value);
  }

  return headers;
}
