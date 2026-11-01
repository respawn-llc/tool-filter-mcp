export function parseEnvVars(envArray: string[]): Record<string, string> {
  const envVars: Record<string, string> = {};

  for (const envStr of envArray) {
    const separatorIndex = envStr.indexOf('=');
    if (separatorIndex === -1) {
      console.error(
        `Error: Invalid environment variable format: "${envStr}". Expected KEY=value format.`
      );
      process.exit(1);
    }

    const key = envStr.slice(0, separatorIndex).trim();
    const value = envStr.slice(separatorIndex + 1);

    if (key.length === 0) {
      console.error(
        `Warning: Invalid environment variable format: "${envStr}". Key cannot be empty.`
      );
      continue;
    }

    envVars[key] = value;
  }

  return envVars;
}
