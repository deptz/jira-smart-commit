import * as vscode from 'vscode';
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';
import { getCurrentBranch, extractJiraKeyFromBranch, getRepositoryRoot, clearRepositoryCache } from './gitOperations';
import { detectProjectLanguage } from './languageDetector';
import { fetchIssue } from '../jiraClient';
import { JiraIssue } from '../types';

const exec = promisify(cpExec);

/**
 * Security context for building the review prompt
 */
export type SecurityContext = {
  recentCommitsDiff: string;
  stagedChangesDiff: string;
  frameworkContext?: string;
  currentBranch: string;
  jiraKey?: string;
  jiraIssue?: JiraIssue;
};

/**
 * Generate unified diff for all commits on the current branch
 */
async function getRecentCommitsDiff(cwd: string): Promise<string> {
  try {
    // Get current branch name
    const { stdout: currentBranch } = await exec('git rev-parse --abbrev-ref HEAD', { cwd });
    const branchName = currentBranch.trim();
    
    // Get all commits on current branch (no limit)
    const { stdout: commits } = await exec(`git log --oneline ${branchName}`, { cwd });
    if (!commits.trim()) {
      return '(no commits found on current branch)';
    }
    
    // Get the oldest commit hash from the list
    const commitLines = commits.trim().split('\n');
    const oldestCommit = commitLines[commitLines.length - 1].split(' ')[0];
    
    // Check if this is the first commit (no parent)
    try {
      // Try to get parent - if it fails, this is the first commit
      await exec(`git rev-parse --verify ${oldestCommit}^`, { cwd });
      // Has parent - get diff from oldest commit's parent to HEAD
      const { stdout: diff } = await exec(`git diff ${oldestCommit}^..HEAD`, { cwd });
      return diff.trim() || '(no diff available)';
    } catch {
      // First commit - get diff using empty tree (shows all files as additions)
      const { stdout: diff } = await exec(`git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD`, { cwd });
      return diff.trim() || '(no diff available)';
    }
  } catch (error) {
    console.warn('Failed to get recent commits diff:', error);
    return '(failed to generate diff for recent commits)';
  }
}

/**
 * Generate unified diff for staged changes
 */
async function getStagedChangesDiff(cwd: string): Promise<string> {
  try {
    const { stdout: diff } = await exec('git diff --cached', { cwd });
    return diff.trim() || '(no staged changes)';
  } catch (error) {
    console.warn('Failed to get staged changes diff:', error);
    return '(failed to generate diff for staged changes)';
  }
}

/**
 * Build framework context string
 */
async function buildFrameworkContext(workspaceRoot: string): Promise<string | undefined> {
  try {
    const language = await detectProjectLanguage(workspaceRoot);
    if (!language) {
      return undefined;
    }
    
    const parts: string[] = [];
    parts.push(`Language: ${language.language}`);
    
    if (language.framework) {
      parts.push(`Framework: ${language.framework}`);
    }
    
    if (language.testFramework) {
      parts.push(`Test Framework: ${language.testFramework}`);
    }
    
    return parts.join(', ');
  } catch (error) {
    console.warn('Failed to detect framework context:', error);
    return undefined;
  }
}

/**
 * Fill security review template with context
 */
function fillSecurityTemplate(template: string, context: SecurityContext): string {
  let filled = template;
  
  // Replace placeholders
  filled = filled.replace(/\{\{RECENT_COMMITS_DIFF\}\}/g, context.recentCommitsDiff);
  filled = filled.replace(/\{\{STAGED_CHANGES_DIFF\}\}/g, context.stagedChangesDiff);
  
  const frameworkContext = context.frameworkContext || '(not detected)';
  filled = filled.replace(/\{\{FRAMEWORK_CONTEXT\}\}/g, frameworkContext);
  
  return filled;
}

/**
 * Generate security review prompt using GitHub Copilot Chat
 */
async function generateWithCopilot(prompt: string, autoSubmit: boolean): Promise<string> {
  if (autoSubmit) {
    // Auto-submit mode: Send to Copilot Chat and wait for response
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: prompt
    });
    
    // Note: In auto-submit mode, user needs to manually copy the response
    // We return empty string to indicate user should get it from chat
    return '';
  } else {
    // Manual mode: Copy to clipboard and paste into chat for review
    await vscode.env.clipboard.writeText(prompt);
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    
    // Small delay to ensure chat panel is focused
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Paste from clipboard into the chat input
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    
    // Return empty string to indicate user should review and submit
    return '';
  }
}

/**
 * Review security with progress reporting
 */
export async function reviewSecurityWithProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<void> {
  progress.report({ message: 'Analyzing Git repository...', increment: 10 });
  
  // Clear any cached repository from previous runs
  clearRepositoryCache();
  
  // Check if feature is enabled
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.security');
  const enabled = config.get('enabled', true) as boolean;
  
  if (!enabled) {
    throw new Error('Security Review is disabled');
  }
  
  // Step 1: Get Git information
  const currentBranch = await getCurrentBranch();
  const workspaceRoot = await getRepositoryRoot();
  
  progress.report({ message: 'Extracting JIRA key from branch...', increment: 10 });
  
  // Step 2: Extract JIRA key
  const jiraKey = extractJiraKeyFromBranch(currentBranch);
  
  // Step 3: Fetch JIRA issue (optional, for context)
  let jiraIssue: JiraIssue | undefined;
  if (jiraKey) {
    progress.report({ message: `Fetching JIRA issue ${jiraKey}...`, increment: 5 });
    try {
      // Get JIRA configuration
      const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
      const baseUrl = jiraConfig.get('baseUrl') as string;
      const email = jiraConfig.get('email') as string;
      const context = (global as any).extensionContext;
      const apiToken = await context?.secrets.get('jiraApiToken');
      const fetchRelatedIssues = jiraConfig.get('fetchRelatedIssues', false) as boolean;
      
      if (baseUrl && email && apiToken) {
        jiraIssue = await fetchIssue({
          key: jiraKey,
          baseUrl,
          email,
          apiToken,
          fetchRelatedIssues
        });
      }
    } catch (error) {
      console.warn('Could not fetch JIRA issue:', error);
    }
  }
  
  progress.report({ message: 'Generating diffs for all commits on branch...', increment: 15 });
  
  // Step 4: Get unified diff for all commits on current branch
  const { getSecurityConfigWithTeamDefaults } = await import('../aiConfigManager');
  const securityConfig = getSecurityConfigWithTeamDefaults(workspaceRoot);
  const recentCommitsDiff = await getRecentCommitsDiff(workspaceRoot);
  
  progress.report({ message: 'Generating diff for staged changes...', increment: 15 });
  
  // Step 5: Get unified diff for staged changes
  const stagedChangesDiff = await getStagedChangesDiff(workspaceRoot);
  
  progress.report({ message: 'Detecting framework context...', increment: 10 });
  
  // Step 6: Detect framework context
  const frameworkContext = await buildFrameworkContext(workspaceRoot);
  
  progress.report({ message: 'Building security review prompt...', increment: 10 });
  
  // Step 7: Build security context
  const securityContext: SecurityContext = {
    recentCommitsDiff,
    stagedChangesDiff,
    frameworkContext,
    currentBranch,
    jiraKey: jiraKey || undefined,
    jiraIssue
  };
  
  // Step 8: Get template and generate prompt (using team config)
  const template = securityConfig.promptTemplate;
  if (!template) {
    throw new Error('Security review prompt template is not configured. Please set jiraSmartCommit.security.promptTemplate');
  }
  
  const prompt = fillSecurityTemplate(template, securityContext);
  
  progress.report({ message: 'Sending to Copilot Chat...', increment: 10 });
  
  // Step 9: Generate with Copilot (using team config if available)
  const autoSubmit = securityConfig.autoSubmit;
  const result = await generateWithCopilot(prompt, autoSubmit);
  
  // If autoSubmit or manual mode, result will be empty
  if (!result) {
    throw new Error(
      'Please review the security analysis generated in Copilot Chat, then copy it to continue.\n\n' +
      'The security review has been ' + (autoSubmit ? 'submitted to' : 'pasted into') + ' Copilot Chat for your review.'
    );
  }
  
  progress.report({ message: 'Complete', increment: 5 });
}

