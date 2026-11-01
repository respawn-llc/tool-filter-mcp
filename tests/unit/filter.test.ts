import { describe, it, expect } from 'vitest';
import { RegexFilter, applyFilters } from '../../src/filter.js';
import { FilteredTool } from '../../src/types.js';

describe('filter', () => {
  const sampleTools: FilteredTool[] = [
    { name: 'read_file', description: 'Read a file', inputSchema: {} },
    { name: 'write_file', description: 'Write a file', inputSchema: {} },
    { name: 'list_dir', description: 'List directory', inputSchema: {} },
    { name: 'get_env', description: 'Get environment variable', inputSchema: {} },
    { name: 'query_database', description: 'Query database', inputSchema: {} },
  ];

  describe('RegexFilter', () => {
    describe('constructor', () => {
      it('should compile regex patterns successfully', () => {
        const filter = new RegexFilter(['^file_.*', '.*_database$']);
        expect(filter).toBeDefined();
        expect(filter.patterns).toHaveLength(2);
        expect(filter.rawPatterns).toEqual(['^file_.*', '.*_database$']);
      });

      it('should handle empty pattern list', () => {
        const filter = new RegexFilter([]);
        expect(filter.patterns).toHaveLength(0);
        expect(filter.rawPatterns).toHaveLength(0);
      });

      it('should throw on invalid regex pattern', () => {
        expect(() => new RegexFilter(['^[a-z'])).toThrow('Invalid regex pattern');
      });

      it('should throw on unsafe regex pattern', () => {
        expect(() => new RegexFilter(['(a+)+'])).toThrow('Unsafe regex pattern');
      });
    });

    describe('matches', () => {
      it('should match tool name against single pattern', () => {
        const filter = new RegexFilter(['.*_file$']);
        expect(filter.matches('read_file')).toBe(true);
        expect(filter.matches('write_file')).toBe(true);
        expect(filter.matches('list_dir')).toBe(false);
      });

      it('should match tool name against multiple patterns', () => {
        const filter = new RegexFilter(['^file_.*', '.*_database$']);
        expect(filter.matches('file_read')).toBe(true);
        expect(filter.matches('query_database')).toBe(true);
        expect(filter.matches('get_env')).toBe(false);
      });

      it('should match exact tool names', () => {
        const filter = new RegexFilter(['^read_file$', '^write_file$']);
        expect(filter.matches('read_file')).toBe(true);
        expect(filter.matches('write_file')).toBe(true);
        expect(filter.matches('read_file_v2')).toBe(false);
      });

      it('should match substrings case-sensitively', () => {
        const filter = new RegexFilter(['read_file']);
        expect(filter.matches('prefix_read_file_v2')).toBe(true);
        expect(filter.matches('READ_FILE')).toBe(false);
      });

      it('should return false when no patterns', () => {
        const filter = new RegexFilter([]);
        expect(filter.matches('any_tool')).toBe(false);
      });

      it('should handle complex regex patterns', () => {
        const filter = new RegexFilter(['^(read|write)_.*']);
        expect(filter.matches('read_file')).toBe(true);
        expect(filter.matches('write_data')).toBe(true);
        expect(filter.matches('delete_file')).toBe(false);
      });
    });
  });

  describe('applyFilters', () => {
    it('should select tools matching allow patterns', () => {
      const result = applyFilters(sampleTools, {
        allowPatterns: ['^read_'],
        denyPatterns: [],
      });

      expect(result.allowed.map((tool) => tool.name)).toEqual(['read_file']);
    });

    it('should exclude allowed tools that also match deny patterns', () => {
      const result = applyFilters(sampleTools, {
        allowPatterns: ['^read_', '^write_'],
        denyPatterns: ['^write_'],
      });

      expect(result.allowed.map((tool) => tool.name)).toEqual(['read_file']);
      expect(result.denied).toEqual(['write_file']);
    });

    it('should return no tools when allow patterns match nothing', () => {
      const result = applyFilters(sampleTools, {
        allowPatterns: ['not_a_tool'],
        denyPatterns: [],
      });

      expect(result.allowed).toEqual([]);
      expect(result.invalidPatterns).toEqual([]);
    });

    it('should preserve upstream order for allow matches', () => {
      const result = applyFilters(sampleTools, {
        allowPatterns: ['^query_', '^read_'],
        denyPatterns: [],
      });

      expect(result.allowed.map((tool) => tool.name)).toEqual(['read_file', 'query_database']);
    });

    it('should validate allow patterns when the upstream list is empty', () => {
      expect(() => applyFilters([], { allowPatterns: ['^[a-z'], denyPatterns: [] })).toThrow(
        'Invalid regex pattern'
      );
    });

    it('should reject unsafe allow patterns when the upstream list is empty', () => {
      expect(() => applyFilters([], { allowPatterns: ['(a+)+'], denyPatterns: [] })).toThrow(
        'Unsafe regex pattern'
      );
    });

    it('should validate deny patterns when allow selects no tools', () => {
      expect(() =>
        applyFilters(sampleTools, {
          allowPatterns: ['not_a_tool'],
          denyPatterns: ['^[a-z'],
        })
      ).toThrow('Invalid regex pattern');
    });

    it('should reject unsafe deny patterns when allow selects no tools', () => {
      expect(() =>
        applyFilters(sampleTools, {
          allowPatterns: ['not_a_tool'],
          denyPatterns: ['(a+)+'],
        })
      ).toThrow('Unsafe regex pattern');
    });

    it('should allow all tools when no deny patterns', () => {
      const result = applyFilters(sampleTools, { allowPatterns: [], denyPatterns: [] });
      expect(result.allowed).toHaveLength(5);
      expect(result.allowed).toEqual(sampleTools);
      expect(result.denied).toHaveLength(0);
      expect(result.invalidPatterns).toHaveLength(0);
    });

    it('should filter tools matching deny pattern', () => {
      const result = applyFilters(sampleTools, { allowPatterns: [], denyPatterns: ['.*_file$'] });
      expect(result.allowed).toHaveLength(3);
      expect(result.allowed.map((t) => t.name)).toEqual(['list_dir', 'get_env', 'query_database']);
      expect(result.denied).toEqual(['read_file', 'write_file']);
      expect(result.invalidPatterns).toHaveLength(0);
    });

    it('should filter tools with multiple deny patterns', () => {
      const result = applyFilters(sampleTools, {
        allowPatterns: [],
        denyPatterns: ['^read_.*', '.*_database$'],
      });
      expect(result.allowed).toHaveLength(3);
      expect(result.allowed.map((t) => t.name)).toEqual(['write_file', 'list_dir', 'get_env']);
      expect(result.denied).toEqual(['read_file', 'query_database']);
    });

    it('should handle exact name filtering', () => {
      const result = applyFilters(sampleTools, {
        allowPatterns: [],
        denyPatterns: ['^read_file$', '^write_file$'],
      });
      expect(result.allowed).toHaveLength(3);
      expect(result.denied).toEqual(['read_file', 'write_file']);
    });

    it('should filter all tools when pattern matches everything', () => {
      const result = applyFilters(sampleTools, { allowPatterns: [], denyPatterns: ['.*'] });
      expect(result.allowed).toHaveLength(0);
      expect(result.denied).toHaveLength(5);
    });

    it('should detect invalid patterns that match nothing', () => {
      const result = applyFilters(sampleTools, {
        allowPatterns: [],
        denyPatterns: ['nonexistent_tool', '^xyz_.*'],
      });
      expect(result.allowed).toHaveLength(5);
      expect(result.denied).toHaveLength(0);
      expect(result.invalidPatterns).toEqual(['nonexistent_tool', '^xyz_.*']);
    });

    it('should handle empty tool list', () => {
      const result = applyFilters([], { allowPatterns: [], denyPatterns: ['.*_file$'] });
      expect(result.allowed).toHaveLength(0);
      expect(result.denied).toHaveLength(0);
      expect(result.invalidPatterns).toEqual(['.*_file$']);
    });

    it('should preserve tool order in allowed list', () => {
      const result = applyFilters(sampleTools, { allowPatterns: [], denyPatterns: ['^write_.*'] });
      expect(result.allowed.map((t) => t.name)).toEqual([
        'read_file',
        'list_dir',
        'get_env',
        'query_database',
      ]);
    });

    it('should handle pattern matching subset of tools', () => {
      const result = applyFilters(sampleTools, { allowPatterns: [], denyPatterns: ['_file$'] });
      expect(result.allowed.map((t) => t.name)).toEqual(['list_dir', 'get_env', 'query_database']);
      expect(result.denied).toEqual(['read_file', 'write_file']);
      expect(result.invalidPatterns).toHaveLength(0);
    });

    it('should throw on invalid regex pattern', () => {
      expect(() =>
        applyFilters(sampleTools, { allowPatterns: [], denyPatterns: ['^[a-z'] })
      ).toThrow('Invalid regex pattern');
    });

    it('should throw on unsafe regex pattern', () => {
      expect(() =>
        applyFilters(sampleTools, { allowPatterns: [], denyPatterns: ['(a+)+'] })
      ).toThrow('Unsafe regex pattern');
    });
  });
});
