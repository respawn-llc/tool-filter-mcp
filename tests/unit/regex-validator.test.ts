import { describe, it, expect } from 'vitest';
import { validateRegexPattern, validateRegexPatterns } from '../../src/utils/regex-validator.js';

describe('regex-validator', () => {
  describe('validateRegexPattern', () => {
    it('should accept valid simple regex', () => {
      const result = validateRegexPattern('^test$');
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid regex with character classes', () => {
      const result = validateRegexPattern('^file_[a-z]+$');
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(true);
    });

    it('should accept valid regex with quantifiers', () => {
      const result = validateRegexPattern('.*_database$');
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(true);
    });

    it('should reject invalid regex syntax', () => {
      const result = validateRegexPattern('^[a-z');
      expect(result.valid).toBe(false);
      expect(result.safe).toBe(false);
      expect(result.error).toContain('Invalid regex pattern');
      expect(result.error).not.toContain('deny list');
    });

    it('should reject regex with catastrophic backtracking', () => {
      const result = validateRegexPattern('(a+)+');
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(false);
      expect(result.error).toContain('Unsafe regex pattern detected');
      expect(result.error).toContain('catastrophic backtracking');
    });

    it('should reject nested quantifiers', () => {
      const result = validateRegexPattern('(x+)*');
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(false);
      expect(result.error).toContain('Unsafe regex pattern');
    });
  });

  describe('validateRegexPatterns', () => {
    it('should accept array of valid patterns', () => {
      const result = validateRegexPatterns(['^file_.*', '.*_database$', '^test$']);
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(true);
    });

    it('should reject if any pattern is invalid', () => {
      const result = validateRegexPatterns(['^file_.*', '^[a-z', '.*_database$']);
      expect(result.valid).toBe(false);
      expect(result.safe).toBe(false);
      expect(result.error).toContain('Invalid regex pattern');
    });

    it('should reject if any pattern is unsafe', () => {
      const result = validateRegexPatterns(['^file_.*', '(a+)+', '.*_database$']);
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(false);
      expect(result.error).toContain('Unsafe regex pattern');
    });

    it('should accept empty array', () => {
      const result = validateRegexPatterns([]);
      expect(result.valid).toBe(true);
      expect(result.safe).toBe(true);
    });
  });
});
