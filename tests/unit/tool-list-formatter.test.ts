import { describe, it, expect } from 'vitest';
import { formatToolsList } from '../../src/utils/tool-list-formatter.js';

describe('formatToolsList', () => {
  const sampleTools = [
    {
      name: 'read_file',
      description: 'Read a file from the filesystem',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_directory',
      description: 'List contents of a directory',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  describe('JSON format', () => {
    it('should format tools as JSON array', () => {
      const result = formatToolsList(sampleTools, 'json');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toHaveProperty('name', 'read_file');
      expect(parsed[0]).toHaveProperty('description', 'Read a file from the filesystem');
      expect(parsed[0]).toHaveProperty('inputSchema');
    });

    it('should format empty list as empty JSON array', () => {
      const result = formatToolsList([], 'json');
      expect(result).toBe('[]');
    });

    it('should include all tool properties', () => {
      const result = formatToolsList([sampleTools[0]], 'json');
      const parsed = JSON.parse(result);

      expect(parsed[0]).toEqual(sampleTools[0]);
    });
  });

  describe('names format', () => {
    it('should format tools as comma-separated names', () => {
      const result = formatToolsList(sampleTools, 'names');
      expect(result).toBe('read_file,write_file,list_directory');
    });

    it('should handle single tool', () => {
      const result = formatToolsList([sampleTools[0]], 'names');
      expect(result).toBe('read_file');
    });

    it('should return empty string for empty list', () => {
      const result = formatToolsList([], 'names');
      expect(result).toBe('');
    });

    it('should handle tools with long names', () => {
      const tools = [
        { name: 'very_long_tool_name_here', description: 'Test', inputSchema: {} },
        { name: 'another_long_name', description: 'Test', inputSchema: {} },
      ];
      const result = formatToolsList(tools, 'names');
      expect(result).toBe('very_long_tool_name_here,another_long_name');
    });
  });

  describe('table format', () => {
    it('should format tools as a readable table', () => {
      const result = formatToolsList(sampleTools, 'table');

      expect(result).toContain('Available tools (3 total)');
      expect(result).toContain('read_file');
      expect(result).toContain('Read a file from the filesystem');
      expect(result).toContain('write_file');
      expect(result).toContain('Write content to a file');
      expect(result).toContain('list_directory');
      expect(result).toContain('List contents of a directory');
    });

    it('should handle tools without descriptions', () => {
      const tools = [{ name: 'tool_no_desc', inputSchema: {} }];
      const result = formatToolsList(tools, 'table');

      expect(result).toContain('tool_no_desc');
      expect(result).toContain('(no description)');
    });

    it('should align names properly', () => {
      const tools = [
        { name: 'short', description: 'Short name', inputSchema: {} },
        { name: 'very_long_tool_name', description: 'Long name', inputSchema: {} },
      ];
      const result = formatToolsList(tools, 'table');
      const lines = result.split('\n');

      // Should have consistent spacing between names and descriptions
      expect(lines.length).toBeGreaterThan(2);
      expect(result).toContain('short');
      expect(result).toContain('very_long_tool_name');
    });

    it('should return empty string for empty list', () => {
      const result = formatToolsList([], 'table');
      expect(result).toBe('');
    });

    it('should show correct count in header', () => {
      const singleTool = [sampleTools[0]];
      const result = formatToolsList(singleTool, 'table');
      expect(result).toContain('Available tools (1 total)');
    });

    it('should truncate long descriptions to 100 characters', () => {
      const tools = [
        {
          name: 'long_desc',
          description: 'A'.repeat(150), // 150 character description
          inputSchema: {},
        },
      ];
      const result = formatToolsList(tools, 'table');

      // Should contain first 100 chars + "..."
      expect(result).toContain('A'.repeat(100) + '...');
      expect(result).not.toContain('A'.repeat(101));
    });

    it('should show only first line of multi-line descriptions', () => {
      const tools = [
        {
          name: 'multiline',
          description: 'First line\nSecond line\nThird line',
          inputSchema: {},
        },
      ];
      const result = formatToolsList(tools, 'table');

      expect(result).toContain('First line...');
      expect(result).not.toContain('Second line');
      expect(result).not.toContain('Third line');
    });
  });

  describe('edge cases', () => {
    it('should handle tools with special characters in names', () => {
      const tools = [
        { name: 'tool-with-dashes', description: 'Test', inputSchema: {} },
        { name: 'tool_with_underscores', description: 'Test', inputSchema: {} },
        { name: 'tool.with.dots', description: 'Test', inputSchema: {} },
      ];

      const jsonResult = formatToolsList(tools, 'json');
      expect(JSON.parse(jsonResult)).toHaveLength(3);

      const namesResult = formatToolsList(tools, 'names');
      expect(namesResult).toBe('tool-with-dashes,tool_with_underscores,tool.with.dots');
    });

    it('should handle very long descriptions in table format', () => {
      const tools = [
        {
          name: 'tool',
          description:
            'This is a very long description that goes on and on and on and contains a lot of text that might wrap in a terminal window',
          inputSchema: {},
        },
      ];
      const result = formatToolsList(tools, 'table');
      // Description is 127 chars, truncated to first 100 chars + "..."
      const expectedTruncated = tools[0].description.substring(0, 100) + '...';
      expect(result).toContain(expectedTruncated);
      expect(result).not.toContain('wrap in a terminal window');
    });

    it('should handle empty descriptions gracefully', () => {
      const tools = [
        { name: 'tool1', description: '', inputSchema: {} },
        { name: 'tool2', description: undefined, inputSchema: {} },
      ];

      const tableResult = formatToolsList(tools, 'table');
      expect(tableResult).toContain('(no description)');
    });
  });
});
