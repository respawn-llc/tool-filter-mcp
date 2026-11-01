import { describe, it, expect } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

describe('CLI stdio argument parsing', () => {
  const cliPath = join(process.cwd(), 'dist', 'index.js');

  function runCLI(
    args: string[],
    timeout: number = 10000
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = spawn('node', [cliPath, ...args]);
      let stdout = '';
      let stderr = '';
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          resolve({ stdout, stderr, exitCode: null });
        }
      }, timeout);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (exitCode) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({ stdout, stderr, exitCode });
        }
      });

      proc.once('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  it('should error when neither --upstream nor --upstream-stdio is provided', async () => {
    const result = await runCLI(['--deny', 'test']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Either --upstream or --upstream-stdio is required');
  });

  it('should error when both --upstream and --upstream-stdio are provided', async () => {
    const result = await runCLI([
      '--upstream',
      'http://localhost:3000',
      '--upstream-stdio',
      'node',
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--upstream and --upstream-stdio are mutually exclusive');
  });

  it('should warn when positional args are used with --upstream (HTTP mode)', async () => {
    const result = await runCLI(['--upstream', 'http://localhost:3000', '--', 'test-arg']);

    expect(result.stderr).toContain(
      'Positional arguments are only applicable with --upstream-stdio'
    );
  });

  it('should error when --upstream-stdio is used without command', async () => {
    const result = await runCLI(['--upstream-stdio']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--upstream-stdio requires a command and arguments after --');
  });

  it('should warn when --header is used with --upstream-stdio (stdio mode)', async () => {
    const result = await runCLI([
      '--upstream-stdio',
      '--header',
      'Authorization: Bearer token',
      '--',
      'node',
      'server.js',
    ]);

    expect(result.stderr).toContain('--header is only applicable with --upstream');
  });

  it('should accept --upstream-stdio with positional args', async () => {
    const result = await runCLI([
      '--upstream-stdio',
      '--',
      'node',
      'server.js',
      '--config=test.json',
    ]);

    // Should not show the mutual exclusion error or CLI validation errors
    expect(result.stderr).not.toContain('mutually exclusive');
    expect(result.stderr).not.toContain('Either --upstream or --upstream-stdio is required');
    expect(result.stderr).not.toContain('--upstream-stdio requires a command');
    // The command will fail because server.js doesn't exist, but that's a runtime error, not a CLI parsing error
    // What matters is the arguments were parsed correctly (positional args are used)
    expect(result.stderr).toContain(
      'Connecting to upstream MCP via stdio: node server.js --config=test.json'
    );
  });

  it('should accept --upstream with --header', async () => {
    const result = await runCLI([
      '--upstream',
      'http://localhost:3000',
      '--header',
      'Authorization: Bearer token',
    ]);

    // Should not show the mutual exclusion error
    expect(result.stderr).not.toContain('mutually exclusive');
    // Should not show the --header warning
    expect(result.stderr).not.toContain('--header is only applicable');
  });

  it('should validate URL format for --upstream', async () => {
    const result = await runCLI(['--upstream', 'not-a-valid-url']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid upstream URL');
  });

  it('should accept multiple positional args with args starting with dashes', async () => {
    const result = await runCLI([
      '--upstream-stdio',
      '--deny',
      'test_*',
      '--',
      'uvx',
      '--from',
      'git+https://example.com/repo.git',
      'package-name',
    ]);

    // Should not show CLI validation errors
    expect(result.stderr).not.toContain('mutually exclusive');
    expect(result.stderr).not.toContain('Either --upstream or --upstream-stdio is required');
    expect(result.stderr).not.toContain('--upstream-stdio requires a command');
    expect(result.stderr).not.toContain('Option');
    expect(result.stderr).not.toContain('argument is ambiguous');
    // The command should be parsed correctly with all args including those starting with --
    expect(result.stderr).toContain(
      'Connecting to upstream MCP via stdio: uvx --from git+https://example.com/repo.git package-name'
    );
  });

  it('should accept --env with --upstream-stdio', async () => {
    const result = await runCLI([
      '--upstream-stdio',
      '--env',
      'API_KEY=secret123',
      '--env',
      'DEBUG=true',
      '--',
      'node',
      'server.js',
    ]);

    // Should not show CLI validation errors or warnings
    expect(result.stderr).not.toContain('mutually exclusive');
    expect(result.stderr).not.toContain('Either --upstream or --upstream-stdio is required');
    expect(result.stderr).not.toContain('--env is only applicable');
    // Should show the stdio connection attempt
    expect(result.stderr).toContain('Connecting to upstream MCP via stdio: node server.js');
  });

  it('should warn when --env is used with --upstream (HTTP mode)', async () => {
    const result = await runCLI(['--upstream', 'http://localhost:3000', '--env', 'API_KEY=secret']);

    expect(result.stderr).toContain('--env is only applicable with --upstream-stdio');
  });

  it('should accept multiple --env arguments', async () => {
    const result = await runCLI([
      '--upstream-stdio',
      '--env',
      'VAR1=value1',
      '--env',
      'VAR2=value2',
      '--env',
      'VAR3=value3',
      '--',
      'node',
      'server.js',
    ]);

    // Should not show CLI validation errors
    expect(result.stderr).not.toContain('mutually exclusive');
    expect(result.stderr).not.toContain('Either --upstream or --upstream-stdio is required');
    expect(result.stderr).not.toContain('--env is only applicable');
    expect(result.stderr).toContain('Connecting to upstream MCP via stdio: node server.js');
  });

  it('should accept --env with values containing equals signs', async () => {
    const result = await runCLI([
      '--upstream-stdio',
      '--env',
      'CONNECTION_STRING=postgresql://user:pass@localhost:5432/db',
      '--',
      'node',
      'server.js',
    ]);

    // Should not show CLI validation errors
    expect(result.stderr).not.toContain('mutually exclusive');
    expect(result.stderr).not.toContain('Either --upstream or --upstream-stdio is required');
    expect(result.stderr).toContain('Connecting to upstream MCP via stdio: node server.js');
  });

  it('should accept --env with empty values', async () => {
    const result = await runCLI([
      '--upstream-stdio',
      '--env',
      'EMPTY_VAR=',
      '--',
      'node',
      'server.js',
    ]);

    // Should not show CLI validation errors
    expect(result.stderr).not.toContain('mutually exclusive');
    expect(result.stderr).not.toContain('Either --upstream or --upstream-stdio is required');
    expect(result.stderr).toContain('Connecting to upstream MCP via stdio: node server.js');
  });
});
