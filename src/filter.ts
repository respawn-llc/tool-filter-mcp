import { FilterPatterns, FilteredTool, ToolFilterResult } from './types.js';
import { validateRegexPatterns } from './utils/regex-validator.js';

export class RegexFilter {
  public readonly patterns: RegExp[];
  public readonly rawPatterns: string[];

  constructor(patterns: string[]) {
    const validation = validateRegexPatterns(patterns);
    if (!validation.valid || !validation.safe) {
      throw new Error(validation.error || 'Invalid regex patterns');
    }

    this.rawPatterns = patterns;
    this.patterns = patterns.map((p) => new RegExp(p));
  }

  matches(toolName: string): boolean {
    return this.patterns.some((pattern) => pattern.test(toolName));
  }
}

export function applyFilters<T extends FilteredTool>(
  tools: T[],
  { allowPatterns, denyPatterns }: FilterPatterns
): ToolFilterResult<T> {
  const allowFilter = new RegexFilter(allowPatterns);
  const denyFilter = new RegexFilter(denyPatterns);
  const allowed: T[] = [];
  const denied: string[] = [];
  const matchedPatterns = new Set<number>();

  for (const tool of tools) {
    let matchedDeny = false;
    for (let i = 0; i < denyFilter.patterns.length; i++) {
      if (denyFilter.patterns[i].test(tool.name)) {
        matchedPatterns.add(i);
        matchedDeny = true;
      }
    }

    if (matchedDeny) {
      denied.push(tool.name);
    }

    if (!matchedDeny && (allowPatterns.length === 0 || allowFilter.matches(tool.name))) {
      allowed.push(tool);
    }
  }

  const invalidPatterns: string[] = [];
  for (let i = 0; i < denyPatterns.length; i++) {
    if (!matchedPatterns.has(i)) {
      invalidPatterns.push(denyPatterns[i]);
    }
  }

  return {
    allowed,
    denied,
    invalidPatterns,
  };
}
