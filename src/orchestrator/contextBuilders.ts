import * as vscode from 'vscode';
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';
import { fetchIssue } from '../jiraClient';
import { JiraIssue } from '../types';
import { PRContext } from '../pr/types';
import {
  getCurrentBranch,
  extractJiraKeyFromBranch,
  getCommitLog,
  getFileChanges,
  getRepositoryRoot,
} from '../pr/gitOperations';
import { detectProjectLanguage } from '../pr/languageDetector';
import { detectCoverage } from '../pr/coverageDetector';

const exec = promisify(cpExec);

export type FirstPromptTemplateType = 'task' | 'bug';

export type SecurityTemplateContext = {
  recentCommitsDiff: string;
  stagedChangesDiff: string;
  frameworkContext: string;
};

export function selectFirstPromptTemplateType(issueType: string): FirstPromptTemplateType {
  const normalizedType = issueType.toLowerCase().replace(/[\s-]/g, '');

  if (
    normalizedType.includes('bug') ||
    normalizedType.includes('defect') ||
    normalizedType.includes('fasttrack') ||
    normalizedType.includes('incident')
  ) {
    return 'bug';
  }

  return 'task';
}

export function formatFirstPromptDescription(description: string, summary: string, key: string): string {
  return `**JIRA Key:** ${key}\n**Summary:** ${summary}\n\n**Description:**\n${description}`;
}

export function buildFirstPromptTemplateContext(issue: JiraIssue): Record<string, string> {
  return {
    DESCRIPTION: formatFirstPromptDescription(issue.description, issue.summary, issue.key),
  };
}

export async function tryFetchJiraIssueFromKey(
  jiraKey: string,
  fetchRelatedIssues: boolean
): Promise<JiraIssue | undefined> {
  try {
    const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
    const baseUrl = jiraConfig.get('baseUrl') as string;
    const email = jiraConfig.get('email') as string;
    const context = (global as any).extensionContext as vscode.ExtensionContext | undefined;
    const apiToken = await context?.secrets.get('jiraApiToken');

    if (!baseUrl || !email || !apiToken) {
      return undefined;
    }

    return await fetchIssue({
      key: jiraKey,
      baseUrl,
      email,
      apiToken,
      fetchRelatedIssues,
    });
  } catch (error) {
    return undefined;
  }
}

export async function tryFetchJiraIssueFromBranch(
  branchName: string,
  fetchRelatedIssues: boolean
): Promise<{ jiraKey?: string; jiraIssue?: JiraIssue }> {
  const jiraKey = extractJiraKeyFromBranch(branchName);
  if (!jiraKey) {
    return {};
  }

  const jiraIssue = await tryFetchJiraIssueFromKey(jiraKey, fetchRelatedIssues);
  return {
    jiraKey,
    jiraIssue,
  };
}

export async function getRecentCommitsDiff(cwd: string): Promise<string> {
  try {
    const { stdout: currentBranch } = await exec('git rev-parse --abbrev-ref HEAD', { cwd });
    const branchName = currentBranch.trim();

    const { stdout: commits } = await exec(`git log --oneline ${branchName}`, { cwd });
    if (!commits.trim()) {
      return '(no commits found on current branch)';
    }

    const commitLines = commits.trim().split('\n');
    const oldestCommit = commitLines[commitLines.length - 1].split(' ')[0];

    try {
      await exec(`git rev-parse --verify ${oldestCommit}^`, { cwd });
      const { stdout: diff } = await exec(`git diff ${oldestCommit}^..HEAD`, { cwd });
      return diff.trim() || '(no diff available)';
    } catch {
      const { stdout: diff } = await exec('git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD', {
        cwd,
      });
      return diff.trim() || '(no diff available)';
    }
  } catch (error) {
    console.warn('Failed to get recent commits diff:', error);
    return '(failed to generate diff for recent commits)';
  }
}

export async function getStagedChangesDiff(cwd: string): Promise<string> {
  try {
    const { stdout: diff } = await exec('git diff --cached', { cwd });
    return diff.trim() || '(no staged changes)';
  } catch (error) {
    console.warn('Failed to get staged changes diff:', error);
    return '(failed to generate diff for staged changes)';
  }
}

export async function buildFrameworkContext(workspaceRoot: string): Promise<string> {
  try {
    const language = await detectProjectLanguage(workspaceRoot);
    if (!language) {
      return '(not detected)';
    }

    const parts: string[] = [`Language: ${language.language}`];

    if (language.framework) {
      parts.push(`Framework: ${language.framework}`);
    }

    if (language.testFramework) {
      parts.push(`Test Framework: ${language.testFramework}`);
    }

    return parts.join(', ');
  } catch (error) {
    console.warn('Failed to detect framework context:', error);
    return '(not detected)';
  }
}

export async function buildSecurityTemplateContext(workspaceRoot: string): Promise<SecurityTemplateContext> {
  const recentCommitsDiff = await getRecentCommitsDiff(workspaceRoot);
  const stagedChangesDiff = await getStagedChangesDiff(workspaceRoot);
  const frameworkContext = await buildFrameworkContext(workspaceRoot);

  return {
    recentCommitsDiff,
    stagedChangesDiff,
    frameworkContext,
  };
}

/**
 * Build context string for PR template.
 */
export function buildPRContextString(context: PRContext): string {
  const lines: string[] = [];

  lines.push('### BRANCH INFORMATION');
  lines.push(`Current Branch: ${context.currentBranch}`);
  if (context.baseBranch) {
    lines.push(`Base Branch: ${context.baseBranch}`);
  }
  lines.push('');

  if (context.jiraIssue) {
    lines.push('### JIRA TICKET');
    lines.push(`Key: ${context.jiraIssue.key}`);
    lines.push(`Type: ${context.jiraIssue.issueType}`);
    lines.push(`Summary: ${context.jiraIssue.summary}`);
    if (context.jiraIssue.description) {
      lines.push('');
      lines.push('Description:');
      lines.push(context.jiraIssue.description);
    }
    lines.push('');
  }

  if (context.language) {
    lines.push('### PROJECT INFORMATION');
    lines.push(`Language: ${context.language.language}`);
    if (context.language.framework) {
      lines.push(`Framework: ${context.language.framework}`);
    }
    if (context.language.testFramework) {
      lines.push(`Test Framework: ${context.language.testFramework}`);
    }
    lines.push('');
  }

  if (context.coverage) {
    lines.push('### TEST COVERAGE');
    lines.push(`Coverage: ${context.coverage.percentage.toFixed(2)}%`);
    lines.push(`Tool: ${context.coverage.tool}`);
    lines.push('');
  }

  lines.push('### COMMITS');
  lines.push(`Total Commits: ${context.commits.length}`);
  lines.push('');
  context.commits.slice(0, 20).forEach((commit) => {
    lines.push(`- ${commit.message.split('\n')[0]}`);
    if (commit.files && commit.files.length > 0) {
      lines.push(`  Files: ${commit.files.slice(0, 5).join(', ')}`);
    }
  });
  if (context.commits.length > 20) {
    lines.push(`... and ${context.commits.length - 20} more commits`);
  }
  lines.push('');

  lines.push('### FILE CHANGES');
  lines.push(`Total Files Changed: ${context.fileChanges.length}`);
  lines.push('');

  const added = context.fileChanges.filter((f) => f.status === 'added');
  const modified = context.fileChanges.filter((f) => f.status === 'modified');
  const deleted = context.fileChanges.filter((f) => f.status === 'deleted');
  const renamed = context.fileChanges.filter((f) => f.status === 'renamed');

  if (added.length > 0) {
    lines.push(`Added (${added.length}):`);
    added.slice(0, 10).forEach((f) => lines.push(`  + ${f.path}`));
    if (added.length > 10) lines.push(`  ... and ${added.length - 10} more`);
    lines.push('');
  }

  if (modified.length > 0) {
    lines.push(`Modified (${modified.length}):`);
    modified.slice(0, 10).forEach((f) => lines.push(`  ~ ${f.path}`));
    if (modified.length > 10) lines.push(`  ... and ${modified.length - 10} more`);
    lines.push('');
  }

  if (deleted.length > 0) {
    lines.push(`Deleted (${deleted.length}):`);
    deleted.slice(0, 10).forEach((f) => lines.push(`  - ${f.path}`));
    if (deleted.length > 10) lines.push(`  ... and ${deleted.length - 10} more`);
    lines.push('');
  }

  if (renamed.length > 0) {
    lines.push(`Renamed (${renamed.length}):`);
    renamed.slice(0, 10).forEach((f) => lines.push(`  → ${f.path}`));
    if (renamed.length > 10) lines.push(`  ... and ${renamed.length - 10} more`);
    lines.push('');
  }

  return lines.join('\n');
}

export function buildPRTemplateContext(context: PRContext): Record<string, string> {
  return {
    CONTEXT: buildPRContextString(context),
  };
}

export async function buildPRRuntimeContext(maxCommits = 50): Promise<{
  context: PRContext;
  workspaceRoot: string;
  currentBranch: string;
  jiraKey?: string;
}> {
  const currentBranch = await getCurrentBranch();
  const workspaceRoot = await getRepositoryRoot();
  const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
  const fetchRelatedIssues = jiraConfig.get('fetchRelatedIssues', false) as boolean;
  const { jiraKey, jiraIssue } = await tryFetchJiraIssueFromBranch(currentBranch, fetchRelatedIssues);

  const commits = await getCommitLog(maxCommits);
  const fileChanges = await getFileChanges(commits);

  const language = await detectProjectLanguage(workspaceRoot);

  let coverage: PRContext['coverage'] | undefined;
  try {
    const detected = await detectCoverage(workspaceRoot, language);
    if (detected) {
      coverage = detected;
    }
  } catch {
    coverage = undefined;
  }

  return {
    context: {
      currentBranch,
      baseBranch: undefined,
      jiraKey: jiraKey || undefined,
      jiraIssue,
      commits,
      fileChanges,
      language,
      coverage,
    },
    workspaceRoot,
    currentBranch,
    jiraKey: jiraKey || undefined,
  };
}
