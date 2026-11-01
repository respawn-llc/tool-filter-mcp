import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseHeaders, HeaderParseError } from '../../src/utils/header-parser.js';

describe('header-parser', () => {
  describe('parseHeaders', () => {
    it('should parse single header correctly', () => {
      const headers = parseHeaders(['Authorization: Bearer token123']);
      expect(headers).toEqual({ Authorization: 'Bearer token123' });
    });

    it('should parse multiple headers correctly', () => {
      const headers = parseHeaders([
        'Authorization: Bearer token123',
        'X-Custom-Header: value',
        'Content-Type: application/json',
      ]);
      expect(headers).toEqual({
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'value',
        'Content-Type': 'application/json',
      });
    });

    it('should trim whitespace from header name and value', () => {
      const headers = parseHeaders(['  Authorization  :  Bearer token123  ']);
      expect(headers).toEqual({ Authorization: 'Bearer token123' });
    });

    it('should allow empty header value', () => {
      const headers = parseHeaders(['X-Empty:']);
      expect(headers).toEqual({ 'X-Empty': '' });
    });

    it('should allow value with multiple colons', () => {
      const headers = parseHeaders(['Authorization: Bearer: token:123']);
      expect(headers).toEqual({ Authorization: 'Bearer: token:123' });
    });

    it('should throw error on missing colon', () => {
      expect(() => parseHeaders(['InvalidHeader'])).toThrow(HeaderParseError);
      expect(() => parseHeaders(['InvalidHeader'])).toThrow('must be in "Name: Value" format');
    });

    it('should throw error on empty header name', () => {
      expect(() => parseHeaders([': value'])).toThrow(HeaderParseError);
      expect(() => parseHeaders([': value'])).toThrow('Header name cannot be empty');
    });

    it('should throw error on invalid characters in header name', () => {
      expect(() => parseHeaders(['Invalid Header: value'])).toThrow(HeaderParseError);
      expect(() => parseHeaders(['Invalid Header: value'])).toThrow('invalid characters');
    });

    it('should accept valid header name characters', () => {
      const headers = parseHeaders([
        'X-Custom-Header: value',
        'X_Custom_Header: value2',
        'X123: value3',
      ]);
      expect(headers['X-Custom-Header']).toBe('value');
      expect(headers['X_Custom_Header']).toBe('value2');
      expect(headers['X123']).toBe('value3');
    });

    it('should warn and use last value for duplicate headers', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      const headers = parseHeaders(['Authorization: Bearer first', 'Authorization: Bearer second']);

      expect(headers).toEqual({ Authorization: 'Bearer second' });
      expect(consoleSpy.calls.some((call) => call.includes('Duplicate header'))).toBe(true);

      console.error = originalError;
    });

    it('should handle empty array', () => {
      const headers = parseHeaders([]);
      expect(headers).toEqual({});
    });
  });

  describe('environment variable expansion', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should expand ${VAR} syntax', () => {
      process.env.API_TOKEN = 'secret123';
      const headers = parseHeaders(['Authorization: Bearer ${API_TOKEN}']);
      expect(headers).toEqual({ Authorization: 'Bearer secret123' });
    });

    it('should expand $VAR syntax', () => {
      process.env.API_TOKEN = 'secret123';
      const headers = parseHeaders(['Authorization: Bearer $API_TOKEN']);
      expect(headers).toEqual({ Authorization: 'Bearer secret123' });
    });

    it('should expand multiple variables in same value', () => {
      process.env.PREFIX = 'Bearer';
      process.env.TOKEN = 'secret123';
      const headers = parseHeaders(['Authorization: $PREFIX ${TOKEN}']);
      expect(headers).toEqual({ Authorization: 'Bearer secret123' });
    });

    it('should use empty string for undefined variables', () => {
      const consoleSpy = { calls: [] as string[] };
      const originalError = console.error;
      console.error = (...args: string[]) => {
        consoleSpy.calls.push(args.join(' '));
      };

      const headers = parseHeaders(['Authorization: Bearer $UNDEFINED_VAR']);
      expect(headers).toEqual({ Authorization: 'Bearer ' });
      expect(
        consoleSpy.calls.some(
          (call) => call.includes('UNDEFINED_VAR') && call.includes('not defined')
        )
      ).toBe(true);

      console.error = originalError;
    });

    it('should not expand variables without proper format', () => {
      const headers = parseHeaders(['Authorization: $ {TOKEN}']);
      expect(headers).toEqual({ Authorization: '$ {TOKEN}' });
    });

    it('should expand variables case-insensitively', () => {
      process.env.api_token = 'lowercase';
      process.env.API_TOKEN = 'uppercase';
      const headers = parseHeaders(['X-Lower: $api_token', 'X-Upper: $API_TOKEN']);
      expect(headers['X-Lower']).toBe('lowercase');
      expect(headers['X-Upper']).toBe('uppercase');
    });
  });
});
