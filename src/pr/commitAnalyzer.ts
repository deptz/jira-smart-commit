import { CommitInfo, CommitGroups } from './types';

/**
 * Conventional commit types
 */
const COMMIT_TYPES = {
  feat: 'Features',
  fix: 'Bug Fixes',
  refactor: 'Refactoring',
  perf: 'Performance',
  docs: 'Documentation',
  style: 'Styling',
  test: 'Tests',
  build: 'Build',
  ci: 'CI/CD',
  chore: 'Chores',
  revert: 'Reverts'
};

/**
 * Group commits by conventional commit type
 */
export function groupCommits(commits: CommitInfo[]): CommitGroups {
  const groups: CommitGroups = {
    feat: [],
    fix: [],
    refactor: [],
    perf: [],
    docs: [],
    style: [],
    test: [],
    build: [],
    ci: [],
    chore: [],
    other: []
  };

  for (const commit of commits) {
    const type = extractCommitType(commit.message);
    const group = type && type in groups ? type : 'other';
    groups[group as keyof CommitGroups].push(commit);
  }

  return groups;
}

/**
 * Extract commit type from conventional commit message
 * Examples:
 *   "feat(auth): add login" -> "feat"
 *   "fix: resolve bug" -> "fix"
 *   "WIP: testing" -> null
 */
export function extractCommitType(message: string): string | null {
  // Match conventional commit format: type(scope)?: message or type!: message
  const conventionalMatch = message.match(/^(\w+)(?:\([^)]*\))?[!]?:\s/);
  if (conventionalMatch) {
    const type = conventionalMatch[1].toLowerCase();
    return type in COMMIT_TYPES ? type : null;
  }

  return null;
}

/**
 * Extract scope from conventional commit message
 * Examples:
 *   "feat(auth): add login" -> "auth"
 *   "fix: resolve bug" -> null
 *   "feat(api)!: breaking change" -> "api"
 */
export function extractScope(message: string): string | null {
  const scopeMatch = message.match(/^\w+\(([^)]+)\)[!]?:\s/);
  return scopeMatch ? scopeMatch[1] : null;
}

/**
 * Check if commit indicates a breaking change
 */
export function isBreakingChange(commit: CommitInfo): boolean {
  // Check for ! in type
  if (commit.message.match(/^\w+(?:\([^)]*\))?!:\s/)) {
    return true;
  }

  // Check for BREAKING CHANGE in body
  if (commit.body && commit.body.includes('BREAKING CHANGE')) {
    return true;
  }

  return false;
}

/**
 * Extract breaking change description from commit
 */
export function extractBreakingChangeDescription(commit: CommitInfo): string | null {
  if (!commit.body) {
    return null;
  }

  // Look for "BREAKING CHANGE: description"
  const match = commit.body.match(/BREAKING CHANGE:\s*(.+)/);
  return match ? match[1].trim() : null;
}

/**
 * Get commit message without type/scope prefix
 * Examples:
 *   "feat(auth): add login" -> "add login"
 *   "fix: resolve bug" -> "resolve bug"
 *   "WIP: testing" -> "WIP: testing"
 */
export function getCleanMessage(message: string): string {
  const match = message.match(/^\w+(?:\([^)]*\))?[!]?:\s*(.+)$/);
  return match ? match[1] : message;
}

/**
 * Group commits by scope for better organization
 */
export function groupByScope(commits: CommitInfo[]): Map<string, CommitInfo[]> {
  const scopeGroups = new Map<string, CommitInfo[]>();

  for (const commit of commits) {
    const scope = extractScope(commit.message) || 'general';
    if (!scopeGroups.has(scope)) {
      scopeGroups.set(scope, []);
    }
    scopeGroups.get(scope)!.push(commit);
  }

  return scopeGroups;
}

/**
 * Analyze commit patterns and suggest improvements
 */
export function analyzeCommitQuality(commits: CommitInfo[]): {
  conventionalPercentage: number;
  hasBreakingChanges: boolean;
  averageMessageLength: number;
  scopeUsage: number;
} {
  if (commits.length === 0) {
    return {
      conventionalPercentage: 0,
      hasBreakingChanges: false,
      averageMessageLength: 0,
      scopeUsage: 0
    };
  }

  let conventionalCount = 0;
  let scopeCount = 0;
  let totalLength = 0;
  let hasBreaking = false;

  for (const commit of commits) {
    const type = extractCommitType(commit.message);
    if (type) {
      conventionalCount++;
    }

    const scope = extractScope(commit.message);
    if (scope) {
      scopeCount++;
    }

    totalLength += commit.message.length;

    if (isBreakingChange(commit)) {
      hasBreaking = true;
    }
  }

  return {
    conventionalPercentage: (conventionalCount / commits.length) * 100,
    hasBreakingChanges: hasBreaking,
    averageMessageLength: Math.round(totalLength / commits.length),
    scopeUsage: (scopeCount / commits.length) * 100
  };
}

/**
 * Get human-readable group name
 */
export function getGroupDisplayName(type: string): string {
  return COMMIT_TYPES[type as keyof typeof COMMIT_TYPES] || 'Other Changes';
}

/**
 * Sort commit groups by priority
 */
export function getPriorityGroups(groups: CommitGroups): Array<keyof CommitGroups> {
  const priority: Array<keyof CommitGroups> = [
    'feat',
    'fix',
    'refactor',
    'perf',
    'docs',
    'style',
    'test',
    'build',
    'ci',
    'chore',
    'other'
  ];

  return priority.filter(type => groups[type].length > 0);
}

/**
 * Generate commit summary statistics
 */
export function getCommitStatistics(commits: CommitInfo[]): {
  total: number;
  byType: Record<string, number>;
  authors: string[];
  dateRange: { start: Date; end: Date } | null;
} {
  if (commits.length === 0) {
    return {
      total: 0,
      byType: {},
      authors: [],
      dateRange: null
    };
  }

  const byType: Record<string, number> = {};
  const authorSet = new Set<string>();
  let earliest = commits[0].date;
  let latest = commits[0].date;

  for (const commit of commits) {
    const type = extractCommitType(commit.message) || 'other';
    byType[type] = (byType[type] || 0) + 1;
    authorSet.add(commit.author);

    if (commit.date < earliest) {
      earliest = commit.date;
    }
    if (commit.date > latest) {
      latest = commit.date;
    }
  }

  return {
    total: commits.length,
    byType,
    authors: Array.from(authorSet),
    dateRange: { start: earliest, end: latest }
  };
}
