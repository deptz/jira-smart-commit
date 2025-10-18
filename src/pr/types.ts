
import { JiraIssue } from '../types';

/**
 * Configuration preset for branch patterns and base branches
 */
export interface ConfigPreset {
  name: string;
  description: string;
  branchPatterns: RegExp[];
  baseBranches: string[];
}

/**
 * Language configuration and detection info
 */
export interface LanguageConfig {
  language: 'ruby' | 'go' | 'javascript' | 'python' | 'java' | 'other';
  framework?: string;         // e.g., 'rails', 'express', 'django'
  testFramework?: string;     // e.g., 'rspec', 'minitest', 'testing'
  coverageTool?: string;      // e.g., 'simplecov', 'go-test', 'jest'
}

/**
 * Coverage tool configuration
 */
export interface CoverageConfig {
  tool: string;
  language: string;
  reportPath: string;
  threshold: number;
  commands: string[];
  ciArtifactPattern?: string;
}

/**
 * Git commit information
 */
export interface CommitInfo {
  hash: string;              // Short hash (7 chars)
  message: string;           // First line of commit
  body?: string;             // Rest of commit message
  author: string;
  date: Date;
  files: string[];           // Files changed in this commit
}

/**
 * File change information
 */
export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
}

/**
 * Grouped commits by conventional commit type
 */
export interface CommitGroups {
  feat: CommitInfo[];
  fix: CommitInfo[];
  refactor: CommitInfo[];
  perf: CommitInfo[];
  docs: CommitInfo[];
  style: CommitInfo[];
  test: CommitInfo[];
  build: CommitInfo[];
  ci: CommitInfo[];
  chore: CommitInfo[];
  other: CommitInfo[];
}

/**
 * Context for PR description generation
 */
export interface PRContext {
  currentBranch: string;
  baseBranch: string;
  jiraKey?: string;
  jiraIssue?: JiraIssue;
  commits: CommitInfo[];
  fileChanges: FileChange[];
  language: LanguageConfig | null;
  coverage?: {
    percentage: number;
    tool: string;
  };
}

/**
 * Section validation result
 */
export interface SectionValidation {
  isValid: boolean;
  content?: string;
  length: number;
  issues: string[];
}

/**
 * PR description validation result
 */
export interface ValidationResult {
  isValid: boolean;
  score: number;
  summary: SectionValidation;
  changes: SectionValidation;
  testing: SectionValidation;
  impact: SectionValidation;
  notes: SectionValidation;
  warnings: string[];
}

/**
 * PR description generation result
 */
export interface PRGenerationResult {
  description: string;
  validation: ValidationResult;
  estimatedScore: number;
  metadata: {
    commitsAnalyzed: number;
    filesChanged: number;
    jiraAligned: boolean;
    language: string;
    coverageDetected: boolean;
  };
}
