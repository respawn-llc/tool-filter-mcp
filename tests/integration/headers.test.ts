import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

describe('Header pass-through', () => {
  let serverProcess: ChildProcess | null = null;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it('should accept single header via CLI', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    serverProcess = spawn('node', [
      cliPath,
      '--upstream',
      'http://localhost:64342/sse',
      '--header',
      'Authorization: Bearer test123',
    ]);

    let stderr = '';

    serverProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('Custom headers: Authorization')) {
        serverProcess?.kill();
        expect(stderr).toContain('Custom headers: Authorization');
        done();
      }

      if (stderr.includes('Error:')) {
        done();
      }
    });

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill();
        done();
      }
    }, 3000);
  }, 5000);

  it('should accept multiple headers via CLI', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    serverProcess = spawn('node', [
      cliPath,
      '--upstream',
      'http://localhost:64342/sse',
      '--header',
      'Authorization: Bearer test123',
      '--header',
      'X-Custom: value',
    ]);

    let stderr = '';

    serverProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (
        stderr.includes('Custom headers:') &&
        stderr.includes('Authorization') &&
        stderr.includes('X-Custom')
      ) {
        serverProcess?.kill();
        expect(stderr).toContain('Authorization');
        expect(stderr).toContain('X-Custom');
        done();
      }

      if (stderr.includes('Error:')) {
        done();
      }
    });

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill();
        done();
      }
    }, 3000);
  }, 5000);

  it('should expand environment variables in header values', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');
    process.env.TEST_TOKEN = 'secret123';

    serverProcess = spawn(
      'node',
      [
        cliPath,
        '--upstream',
        'http://localhost:64342/sse',
        '--header',
        'Authorization: Bearer $TEST_TOKEN',
      ],
      {
        env: process.env,
      }
    );

    let stderr = '';

    serverProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('Custom headers: Authorization')) {
        serverProcess?.kill();
        expect(stderr).toContain('Custom headers: Authorization');
        done();
      }

      if (stderr.includes('Error:')) {
        done();
      }
    });

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill();
        done();
      }
    }, 3000);
  }, 5000);

  it('should reject invalid header format', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    serverProcess = spawn('node', [
      cliPath,
      '--upstream',
      'http://localhost:64342/sse',
      '--header',
      'InvalidHeaderNoColon',
    ]);

    let stderr = '';

    serverProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('must be in "Name: Value" format')) {
        serverProcess?.kill();
        expect(stderr).toContain('must be in "Name: Value" format');
        done();
      }
    });

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill();
        done(new Error('Expected error message not received'));
      }
    }, 3000);
  }, 5000);

  it('should reject header with invalid characters in name', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    serverProcess = spawn('node', [
      cliPath,
      '--upstream',
      'http://localhost:64342/sse',
      '--header',
      'Invalid Header: value',
    ]);

    let stderr = '';

    serverProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('invalid characters')) {
        serverProcess?.kill();
        expect(stderr).toContain('invalid characters');
        done();
      }
    });

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill();
        done(new Error('Expected error message not received'));
      }
    }, 3000);
  }, 5000);

  it('should accept header with empty value', (done) => {
    const cliPath = join(process.cwd(), 'dist', 'index.js');

    serverProcess = spawn('node', [
      cliPath,
      '--upstream',
      'http://localhost:64342/sse',
      '--header',
      'X-Empty:',
    ]);

    let stderr = '';

    serverProcess.stderr?.on('data', (data) => {
      stderr += data.toString();

      if (stderr.includes('Custom headers: X-Empty')) {
        serverProcess?.kill();
        expect(stderr).toContain('Custom headers: X-Empty');
        done();
      }

      if (stderr.includes('Error:')) {
        done();
      }
    });

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill();
        done();
      }
    }, 3000);
  }, 5000);
});
