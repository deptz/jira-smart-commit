import { PRContext, CommitGroups } from './types';
import { JiraIssue } from '../types';
import { groupCommits, getCleanMessage, getGroupDisplayName, getPriorityGroups, isBreakingChange } from './commitAnalyzer';
import { getTestInstructionsTemplate } from './languageDetector';
import { detectCoverage, formatCoveragePercentage } from './coverageDetector';
import * as vscode from 'vscode';

/**
 * Generate Summary section (## Summary)
 * Provides high-level overview of changes
 */
export async function generateSummarySection(context: PRContext): Promise<string> {
  const lines: string[] = ['## Summary'];
  
  // JIRA context if available
  if (context.jiraIssue) {
    const issue = context.jiraIssue;
    lines.push('');
    lines.push(`**JIRA:** [${issue.key}](${getJiraUrl(context, issue.key)}) - ${issue.summary}`);
    
    if (issue.description) {
      lines.push('');
      lines.push(formatDescription(issue.description));
    }
  }
  
  // High-level change summary
  lines.push('');
  lines.push(generateChangeSummary(context));
  
  return lines.join('\n');
}

/**
 * Generate Changes section (## What Changed)
 * Lists all changes by type
 */
export function generateChangesSection(context: PRContext): string {
  const lines: string[] = ['## What Changed'];
  
  const groups = groupCommits(context.commits);
  const priorityGroups = getPriorityGroups(groups);
  
  if (priorityGroups.length === 0) {
    lines.push('');
    lines.push('_No commits found._');
    return lines.join('\n');
  }
  
  for (const type of priorityGroups) {
    const commits = groups[type];
    if (commits.length === 0) continue;
    
    lines.push('');
    lines.push(`### ${getGroupDisplayName(type)}`);
    
    for (const commit of commits) {
      const cleanMsg = getCleanMessage(commit.message);
      const breaking = isBreakingChange(commit) ? ' ⚠️ **BREAKING**' : '';
      lines.push(`- ${cleanMsg}${breaking} (${commit.hash})`);
    }
  }
  
  // File statistics
  lines.push('');
  lines.push('### Files Changed');
  lines.push(`- **${context.fileChanges.length}** files modified`);
  
  const additions = context.fileChanges.filter(f => f.status === 'added').length;
  const deletions = context.fileChanges.filter(f => f.status === 'deleted').length;
  const modifications = context.fileChanges.filter(f => f.status === 'modified').length;
  const renames = context.fileChanges.filter(f => f.status === 'renamed').length;
  
  if (additions > 0) lines.push(`- ${additions} added`);
  if (deletions > 0) lines.push(`- ${deletions} deleted`);
  if (modifications > 0) lines.push(`- ${modifications} modified`);
  if (renames > 0) lines.push(`- ${renames} renamed`);
  
  return lines.join('\n');
}

/**
 * Generate Testing section (## Testing)
 * Provides test instructions and coverage info
 */
export async function generateTestingSection(context: PRContext): Promise<string> {
  const lines: string[] = ['## Testing'];
  
  // Language-specific test instructions
  const testInstructions = getTestInstructionsTemplate(context.language);
  lines.push('');
  lines.push(testInstructions);
  
  // Coverage information if available
  if (context.coverage) {
    lines.push('');
    lines.push('### Test Coverage');
    lines.push(`- Current coverage: **${formatCoveragePercentage(context.coverage.percentage)}**`);
    lines.push(`- Tool: ${context.coverage.tool}`);
    
    if (context.coverage.percentage >= 80) {
      lines.push('- ✅ Coverage meets standards (≥80%)');
    } else {
      lines.push('- ⚠️ Coverage below recommended threshold (≥80%)');
    }
  }
  
  // Test cases from JIRA
  if (context.jiraIssue?.testCases) {
    lines.push('');
    lines.push('### Test Cases (from JIRA)');
    lines.push(context.jiraIssue.testCases);
  }
  
  return lines.join('\n');
}

/**
 * Generate Impact section (## Impact & Risks)
 * Highlights breaking changes, risks, and deployment notes
 */
export function generateImpactSection(context: PRContext): string {
  const lines: string[] = ['## Impact & Risks'];
  
  // Breaking changes
  const breakingCommits = context.commits.filter(isBreakingChange);
  if (breakingCommits.length > 0) {
    lines.push('');
    lines.push('### ⚠️ Breaking Changes');
    for (const commit of breakingCommits) {
      lines.push(`- ${getCleanMessage(commit.message)}`);
      if (commit.body) {
        const breaking = commit.body.match(/BREAKING CHANGE:\s*(.+)/);
        if (breaking) {
          lines.push(`  - ${breaking[1]}`);
        }
      }
    }
  } else {
    lines.push('');
    lines.push('✅ No breaking changes detected.');
  }
  
  // Database migrations (for Rails)
  if (context.language?.framework === 'rails') {
    const migrations = context.fileChanges.filter(f => 
      f.path.includes('db/migrate') || f.path.includes('db/schema')
    );
    
    if (migrations.length > 0) {
      lines.push('');
      lines.push('### Database Changes');
      lines.push('⚠️ This PR includes database migrations:');
      for (const migration of migrations) {
        const fileName = migration.path.split('/').pop();
        lines.push(`- ${fileName}`);
      }
      lines.push('');
      lines.push('**Action required:** Run migrations after deployment.');
    }
  }
  
  // Configuration changes
  const configFiles = context.fileChanges.filter(f => 
    f.path.includes('config/') || 
    f.path.includes('.env') ||
    f.path.includes('.yml') ||
    f.path.includes('.yaml') ||
    f.path.includes('.json')
  );
  
  if (configFiles.length > 0) {
    lines.push('');
    lines.push('### Configuration Changes');
    lines.push('📝 Configuration files modified:');
    for (const file of configFiles.slice(0, 5)) {
      const fileName = file.path.split('/').pop();
      lines.push(`- ${fileName}`);
    }
    if (configFiles.length > 5) {
      lines.push(`- ...and ${configFiles.length - 5} more`);
    }
  }
  
  // Deployment notes
  if (breakingCommits.length > 0 || configFiles.length > 0) {
    lines.push('');
    lines.push('### Deployment Notes');
    if (breakingCommits.length > 0) {
      lines.push('- ⚠️ Review breaking changes before merging');
      lines.push('- Coordinate with dependent services');
    }
    if (configFiles.length > 0) {
      lines.push('- Update environment variables if needed');
      lines.push('- Verify configuration in staging first');
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate Notes section (## Additional Notes)
 * Includes acceptance criteria, related issues, and technical details
 */
export function generateNotesSection(context: PRContext): string {
  const lines: string[] = ['## Additional Notes'];
  
  // Acceptance criteria from JIRA
  if (context.jiraIssue?.acceptance && context.jiraIssue.acceptance.length > 0) {
    lines.push('');
    lines.push('### Acceptance Criteria');
    for (const criteria of context.jiraIssue.acceptance) {
      lines.push(`- ${criteria}`);
    }
  }
  
  // Related JIRA issues
  if (context.jiraIssue?.relatedKeys && context.jiraIssue.relatedKeys.length > 0) {
    lines.push('');
    lines.push('### Related Issues');
    for (const key of context.jiraIssue.relatedKeys) {
      lines.push(`- [${key}](${getJiraUrl(context, key)})`);
    }
  }
  
  // Technical details
  lines.push('');
  lines.push('### Technical Details');
  lines.push(`- **Branch:** \`${context.currentBranch}\` → \`${context.baseBranch}\``);
  lines.push(`- **Commits:** ${context.commits.length}`);
  lines.push(`- **Files Changed:** ${context.fileChanges.length}`);
  
  if (context.language) {
    const framework = context.language.framework ? ` (${context.language.framework})` : '';
    lines.push(`- **Language:** ${context.language.language}${framework}`);
  }
  
  // Authors
  const authors = new Set(context.commits.map(c => c.author));
  if (authors.size > 0) {
    lines.push(`- **Contributors:** ${Array.from(authors).join(', ')}`);
  }
  
  return lines.join('\n');
}

/**
 * Helper: Get JIRA URL for an issue key
 */
function getJiraUrl(context: PRContext, key: string): string {
  // Try to get base URL from VS Code config
  const config = vscode.workspace.getConfiguration('jiraSmartCommit');
  const baseUrl = config.get('baseUrl', '') as string;
  
  if (baseUrl) {
    return `${baseUrl}/browse/${key}`;
  }
  
  return `https://jira.atlassian.com/browse/${key}`;
}

/**
 * Helper: Format JIRA description with proper markdown
 */
function formatDescription(description: string): string {
  // Limit to first 500 characters for PR summary
  const maxLength = 500;
  let text = description.trim();
  
  if (text.length > maxLength) {
    // Try to break at sentence
    const sentences = text.substring(0, maxLength).split('. ');
    if (sentences.length > 1) {
      sentences.pop(); // Remove incomplete sentence
      text = sentences.join('. ') + '.';
    } else {
      text = text.substring(0, maxLength) + '...';
    }
  }
  
  // Wrap in quote block
  return text.split('\n').map(line => `> ${line}`).join('\n');
}

/**
 * Helper: Generate high-level change summary
 */
function generateChangeSummary(context: PRContext): string {
  const groups = groupCommits(context.commits);
  const parts: string[] = [];
  
  if (groups.feat.length > 0) {
    parts.push(`${groups.feat.length} new feature${groups.feat.length > 1 ? 's' : ''}`);
  }
  if (groups.fix.length > 0) {
    parts.push(`${groups.fix.length} bug fix${groups.fix.length > 1 ? 'es' : ''}`);
  }
  if (groups.refactor.length > 0) {
    parts.push(`${groups.refactor.length} refactor${groups.refactor.length > 1 ? 's' : ''}`);
  }
  
  const otherCount = context.commits.length - groups.feat.length - groups.fix.length - groups.refactor.length;
  if (otherCount > 0) {
    parts.push(`${otherCount} other change${otherCount > 1 ? 's' : ''}`);
  }
  
  if (parts.length === 0) {
    return 'This PR includes various changes to the codebase.';
  }
  
  return `This PR includes ${parts.join(', ')}.`;
}
