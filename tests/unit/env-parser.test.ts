import { describe, it, expect } from 'vitest';
import { parseEnvVars } from '../../src/utils/env-parser.js';

describe('env-parser', () => {
  describe('parseEnvVars', () => {
    it('should parse single environment variable correctly', () => {
      const envVars = parseEnvVars(['API_KEY=secret123']);
      expect(envVars).toEqual({ API_KEY: 'secret123' });
    });

    it('should parse multiple environment variables correctly', () => {
      const envVars = parseEnvVars(['API_KEY=secret123', 'DEBUG=true', 'PORT=3000']);
      expect(envVars).toEqual({
        API_KEY: 'secret123',
        DEBUG: 'true',
        PORT: '3000',
      });
    });

    it('should trim whitespace from key but not value', () => {
      const envVars = parseEnvVars(['  API_KEY  =  secret123  ']);
      expect(envVars).toEqual({ API_KEY: '  secret123  ' });
    });

    it('should allow empty value', () => {
      const envVars = parseEnvVars(['EMPTY_VAR=']);
      expect(envVars).toEqual({ EMPTY_VAR: '' });
    });

    it('should allow value with multiple equals signs', () => {
      const envVars = parseEnvVars(['CONNECTION_STRING=postgresql://user:pass@localhost:5432/db']);
      expect(envVars).toEqual({ CONNECTION_STRING: 'postgresql://user:pass@localhost:5432/db' });
    });

    it('should exit when entry is missing equals sign', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      expect(() => parseEnvVars(['InvalidEntry'])).toThrow(
        'process.exit unexpectedly called with "1"'
      );
      expect(
        consoleSpy.calls.some((call) => call.includes('Invalid environment variable format'))
      ).toBe(true);
      expect(consoleSpy.calls.some((call) => call.includes('InvalidEntry'))).toBe(true);

      console.error = originalError;
    });

    it('should warn and skip entries with empty key', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      const envVars = parseEnvVars(['=value', 'VALID=value']);

      expect(envVars).toEqual({ VALID: 'value' });
      expect(consoleSpy.calls.some((call) => call.includes('Key cannot be empty'))).toBe(true);

      console.error = originalError;
    });

    it('should handle empty array', () => {
      const envVars = parseEnvVars([]);
      expect(envVars).toEqual({});
    });

    it('should overwrite duplicate keys with last value', () => {
      const envVars = parseEnvVars(['API_KEY=first', 'API_KEY=second']);
      expect(envVars).toEqual({ API_KEY: 'second' });
    });

    it('should handle values with spaces', () => {
      const envVars = parseEnvVars(['MESSAGE=Hello World']);
      expect(envVars).toEqual({ MESSAGE: 'Hello World' });
    });

    it('should handle values with special characters', () => {
      const envVars = parseEnvVars([
        'PASSWORD=p@ssw0rd!',
        'PATH=/usr/bin:/usr/local/bin',
        'JSON={"key":"value"}',
      ]);
      expect(envVars).toEqual({
        PASSWORD: 'p@ssw0rd!',
        PATH: '/usr/bin:/usr/local/bin',
        JSON: '{"key":"value"}',
      });
    });

    it('should exit on first invalid entry when mixed with valid entries', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      // Should process VALID1, then exit on InvalidEntry
      expect(() =>
        parseEnvVars([
          'VALID1=value1',
          'InvalidEntry',
          'VALID2=value2',
          '=emptykey',
          'VALID3=value3',
        ])
      ).toThrow('process.exit unexpectedly called with "1"');

      expect(
        consoleSpy.calls.some((call) => call.includes('Invalid environment variable format'))
      ).toBe(true);

      console.error = originalError;
    });
  });
});
