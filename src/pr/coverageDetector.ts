import * as path from 'path';
import * as fs from 'fs';
import { LanguageConfig, CoverageConfig } from './types';

/**
 * Coverage tool configurations
 */
export const COVERAGE_CONFIGS: Record<string, CoverageConfig> = {
  simplecov: {
    tool: 'SimpleCov',
    language: 'ruby',
    reportPath: 'coverage/.resultset.json',
    threshold: 80,
    commands: ['bundle exec rspec', 'bundle exec rake test'],
    ciArtifactPattern: 'coverage/**/*'
  },
  'go-test': {
    tool: 'go test',
    language: 'go',
    reportPath: 'coverage.out',
    threshold: 80,
    commands: ['go test -cover ./...', 'go test -coverprofile=coverage.out ./...'],
    ciArtifactPattern: 'coverage.out'
  }
};

/**
 * Detect test coverage from SimpleCov report
 */
export async function detectSimpleCovCoverage(workspaceRoot: string): Promise<number | null> {
  const reportPath = path.join(workspaceRoot, 'coverage', '.resultset.json');
  
  try {
    const content = await fs.promises.readFile(reportPath, 'utf-8');
    const data = JSON.parse(content);
    
    // SimpleCov stores coverage in various formats
    // Try to extract the overall coverage percentage
    const coverage = extractSimpleCovCoverage(data);
    return coverage;
  } catch (error: any) {
    // Coverage file doesn't exist - this is normal, return null
    return null;
  }
}

/**
 * Extract coverage percentage from SimpleCov data
 */
function extractSimpleCovCoverage(data: any): number | null {
  // SimpleCov format varies, try common structures
  
  // Format 1: Direct metrics
  if (data.metrics?.covered_percent !== undefined) {
    return data.metrics.covered_percent;
  }
  
  // Format 2: RSpec format
  const rspecKey = Object.keys(data).find(k => k.includes('RSpec') || k.includes('spec'));
  if (rspecKey && data[rspecKey]?.coverage) {
    const coverage = data[rspecKey].coverage;
    const total = calculateCoverageFromLines(coverage);
    return total;
  }
  
  // Format 3: Look for timestamp-based keys
  const timestampKey = Object.keys(data).find(k => !isNaN(parseInt(k)));
  if (timestampKey && data[timestampKey]?.coverage) {
    const coverage = data[timestampKey].coverage;
    const total = calculateCoverageFromLines(coverage);
    return total;
  }
  
  return null;
}

/**
 * Calculate coverage percentage from line-by-line coverage data
 */
function calculateCoverageFromLines(coverage: Record<string, number[]>): number {
  let totalLines = 0;
  let coveredLines = 0;
  
  for (const lines of Object.values(coverage)) {
    for (const hitCount of lines) {
      if (hitCount !== null) {
        totalLines++;
        if (hitCount > 0) {
          coveredLines++;
        }
      }
    }
  }
  
  return totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
}

/**
 * Detect test coverage from Go coverage report
 */
export async function detectGoCoverage(workspaceRoot: string): Promise<number | null> {
  const reportPath = path.join(workspaceRoot, 'coverage.out');
  
  try {
    const content = await fs.promises.readFile(reportPath, 'utf-8');
    const coverage = parseGoCoverageOutput(content);
    return coverage;
  } catch (error: any) {
    // Coverage file doesn't exist - this is normal, return null
    return null;
  }
}

/**
 * Parse Go coverage output format
 * Format: mode: set\nfile.go:line.col,line.col statements count
 */
function parseGoCoverageOutput(content: string): number | null {
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('mode:'));
  
  if (lines.length === 0) {
    return null;
  }
  
  let totalStatements = 0;
  let coveredStatements = 0;
  
  for (const line of lines) {
    // Format: file.go:start.col,end.col statements count
    const parts = line.split(' ');
    if (parts.length >= 3) {
      const statements = parseInt(parts[1]);
      const count = parseInt(parts[2]);
      
      if (!isNaN(statements) && !isNaN(count)) {
        totalStatements += statements;
        if (count > 0) {
          coveredStatements += statements;
        }
      }
    }
  }
  
  return totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : null;
}

/**
 * Detect coverage based on language configuration
 */
export async function detectCoverage(
  workspaceRoot: string, 
  languageConfig: LanguageConfig | null
): Promise<{ percentage: number; tool: string } | null> {
  if (!languageConfig) {
    return null;
  }
  
  switch (languageConfig.coverageTool) {
    case 'simplecov': {
      const percentage = await detectSimpleCovCoverage(workspaceRoot);
      return percentage !== null ? { percentage, tool: 'SimpleCov' } : null;
    }
    case 'go-test': {
      const percentage = await detectGoCoverage(workspaceRoot);
      return percentage !== null ? { percentage, tool: 'go test' } : null;
    }
    default:
      return null;
  }
}

/**
 * Check if coverage meets threshold
 */
export function isCoverageSufficient(
  coverage: number,
  languageConfig: LanguageConfig | null
): boolean {
  if (!languageConfig?.coverageTool) {
    return true; // No coverage requirement
  }
  
  const config = COVERAGE_CONFIGS[languageConfig.coverageTool];
  if (!config) {
    return true;
  }
  
  return coverage >= config.threshold;
}

/**
 * Get coverage report instructions for language
 */
export function getCoverageInstructions(languageConfig: LanguageConfig | null): string | null {
  if (!languageConfig?.coverageTool) {
    return null;
  }
  
  const config = COVERAGE_CONFIGS[languageConfig.coverageTool];
  if (!config) {
    return null;
  }
  
  return `Run coverage: \`${config.commands[0]}\``;
}

/**
 * Format coverage percentage for display
 */
export function formatCoveragePercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}

/**
 * Check if coverage report exists
 */
export async function hasCoverageReport(
  workspaceRoot: string,
  languageConfig: LanguageConfig | null
): Promise<boolean> {
  if (!languageConfig?.coverageTool) {
    return false;
  }
  
  const config = COVERAGE_CONFIGS[languageConfig.coverageTool];
  if (!config) {
    return false;
  }
  
  const reportPath = path.join(workspaceRoot, config.reportPath);
  
  try {
    await fs.promises.access(reportPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
