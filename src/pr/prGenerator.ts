import * as vscode from 'vscode';
import { PRContext, PRGenerationResult, LanguageConfig } from './types';
import { getCurrentBranch, extractJiraKeyFromBranch, getCommitLog, getFileChanges, getRepositoryRoot, clearRepositoryCache } from './gitOperations';
import { detectProjectLanguage } from './languageDetector';
import { detectCoverage } from './coverageDetector';
import { fetchIssue } from '../jiraClient';

/**
 * Build context string for PR template
 */
function buildPRContext(context: PRContext): string {
  const lines: string[] = [];
  
  // Branch information
  lines.push('### BRANCH INFORMATION');
  lines.push(`Current Branch: ${context.currentBranch}`);
  if (context.baseBranch) {
    lines.push(`Base Branch: ${context.baseBranch}`);
  }
  lines.push('');
  
  // JIRA information
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
  
  // Language and framework
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
  
  // Coverage information\n  if (context.coverage) {\n    lines.push('### TEST COVERAGE');\n    lines.push(`Coverage: ${context.coverage.percentage.toFixed(2)}%`);\n    lines.push(`Tool: ${context.coverage.tool}`);\n    lines.push('');\n  }
  
  // Commits
  lines.push('### COMMITS');
  lines.push(`Total Commits: ${context.commits.length}`);
  lines.push('');
  context.commits.slice(0, 20).forEach(commit => {
    lines.push(`- ${commit.message.split('\n')[0]}`);
    if (commit.files && commit.files.length > 0) {
      lines.push(`  Files: ${commit.files.slice(0, 5).join(', ')}`);
    }
  });
  if (context.commits.length > 20) {
    lines.push(`... and ${context.commits.length - 20} more commits`);
  }
  lines.push('');
  
  // File changes summary
  lines.push('### FILE CHANGES');
  lines.push(`Total Files Changed: ${context.fileChanges.length}`);
  lines.push('');
  
  // Group by change type
  const added = context.fileChanges.filter(f => f.status === 'added');
  const modified = context.fileChanges.filter(f => f.status === 'modified');
  const deleted = context.fileChanges.filter(f => f.status === 'deleted');
  const renamed = context.fileChanges.filter(f => f.status === 'renamed');
  
  if (added.length > 0) {
    lines.push(`Added (${added.length}):`);
    added.slice(0, 10).forEach(f => lines.push(`  + ${f.path}`));
    if (added.length > 10) lines.push(`  ... and ${added.length - 10} more`);
    lines.push('');
  }
  
  if (modified.length > 0) {
    lines.push(`Modified (${modified.length}):`);
    modified.slice(0, 10).forEach(f => lines.push(`  ~ ${f.path}`));
    if (modified.length > 10) lines.push(`  ... and ${modified.length - 10} more`);
    lines.push('');
  }
  
  if (deleted.length > 0) {
    lines.push(`Deleted (${deleted.length}):`);
    deleted.slice(0, 10).forEach(f => lines.push(`  - ${f.path}`));
    if (deleted.length > 10) lines.push(`  ... and ${deleted.length - 10} more`);
    lines.push('');
  }
  
  if (renamed.length > 0) {
    lines.push(`Renamed (${renamed.length}):`);
    renamed.slice(0, 10).forEach(f => lines.push(`  → ${f.path}`));
    if (renamed.length > 10) lines.push(`  ... and ${renamed.length - 10} more`);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Fill template with PR context
 */
function fillPRTemplate(template: string, context: PRContext): string {
  const contextString = buildPRContext(context);
  return template.replace(/\{\{CONTEXT\}\}/g, contextString);
}

/**
 * Generate PR description using GitHub Copilot Chat
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
 * Main function to generate PR description
 */
export async function generatePRDescription(): Promise<PRGenerationResult> {
  // Clear any cached repository from previous runs
  clearRepositoryCache();
  
  // Check if feature is enabled
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const enabled = config.get('enabled', true) as boolean;
  
  if (!enabled) {
    throw new Error('PR Description Generator is disabled. Enable it in settings: jiraSmartCommit.pr.enabled');
  }
  
  // Step 1: Get Git information
  const currentBranch = await getCurrentBranch();
  
  // Step 2: Extract JIRA key from branch name
  const jiraKey = extractJiraKeyFromBranch(currentBranch);
  
  // Step 3: Fetch JIRA issue if key found
  let jiraIssue;
  if (jiraKey) {
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
      // Continue without JIRA data
    }
  }
  
  // Step 4: Get commit log and file changes from current branch
  const prConfig = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const maxCommits = prConfig.get('maxCommits', 50) as number;
  const commits = await getCommitLog(maxCommits);
  const fileChanges = await getFileChanges(commits);
  
  if (commits.length === 0) {
    throw new Error(
      `No commits found on the current branch '${currentBranch}'.\n\n` +
      `Make sure you have commits on your branch to generate a PR description.`
    );
  }
  
  // Step 5: Detect language and framework
  const workspaceRoot = await getRepositoryRoot();
  const language = await detectProjectLanguage(workspaceRoot);
  
  // Step 6: Detect test coverage
  let coverage;
  try {
    coverage = await detectCoverage(workspaceRoot, language);
  } catch (error) {
    // Coverage detection failed - continue without coverage info
    coverage = null;
  }
  
  // Step 7: Build context
  const context: PRContext = {
    currentBranch,
    baseBranch: undefined, // No base branch needed - analyzing current branch commits
    jiraKey: jiraKey || undefined,
    jiraIssue,
    commits,
    fileChanges,
    language,
    coverage: coverage || undefined
  };
  
  // Send usage tracking data (team gateway only, fire-and-forget)
  try {
    const { sendTrackingData } = await import('../telemetry');
    const { getConfig } = await import('../utils');
    const { randomUUID } = await import('crypto');
    const extensionContext = (global as any).extensionContext;
    const repositoryName = workspaceRoot.split('/').pop() || 'unknown';
    
    if (extensionContext) {
      const cfg = getConfig(workspaceRoot);
      const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
      const userEmail = jiraConfig.get('email', '') as string;
      
      await sendTrackingData(extensionContext, {
        metadataVersion: '1.0',
        feature: 'pr',
        user: userEmail,
        timestamp: new Date().toISOString(),
        requestId: randomUUID(),
        jiraKey: jiraKey || undefined,
        repository: repositoryName,
        branch: currentBranch,
        commitsAnalyzed: commits.length,
        filesChanged: fileChanges.length,
        language: language?.language,
        coverageDetected: !!coverage
      }, {
        enableUsageTracking: cfg.enableUsageTracking,
        trackingUrl: cfg.trackingUrl,
        trackingRequiresAuth: cfg.trackingRequiresAuth,
        anonymizeUser: cfg.anonymizeUser
      });
    }
  } catch (error) {
    // Tracking should never disrupt the main flow - fail silently
  }
  
  // Step 8: Get template and generate prompt
  const template = config.get('promptTemplate', '') as string;
  const prompt = fillPRTemplate(template, context);
  
  // Step 9: Generate PR description with Copilot
  const autoSubmit = config.get('autoSubmit', false) as boolean;
  let description = await generateWithCopilot(prompt, autoSubmit);
  
  // If autoSubmit or manual mode, description will be empty
  // In this case, we need to prompt user to copy from Copilot Chat
  if (!description) {
    throw new Error(
      'Please review the PR description generated in Copilot Chat, then copy it to continue.\n\n' +
      'The description has been ' + (autoSubmit ? 'submitted to' : 'pasted into') + ' Copilot Chat for your review.'
    );
  }
  
  // Step 11: Build result (no validation or scoring)
  const result: PRGenerationResult = {
    description,
    validation: {
      isValid: true,
      score: 0,
      summary: { isValid: true, length: 0, issues: [] },
      changes: { isValid: true, length: 0, issues: [] },
      testing: { isValid: true, length: 0, issues: [] },
      impact: { isValid: true, length: 0, issues: [] },
      notes: { isValid: true, length: 0, issues: [] },
      warnings: []
    },
    estimatedScore: 0,
    metadata: {
      commitsAnalyzed: commits.length,
      filesChanged: fileChanges.length,
      jiraAligned: !!jiraIssue,
      language: language?.language || 'unknown',
      coverageDetected: !!coverage
    }
  };
  
  return result;
}

/**
 * Generate PR description with progress reporting
 */
export async function generatePRDescriptionWithProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<PRGenerationResult> {
  progress.report({ message: 'Analyzing Git repository...', increment: 10 });
  
  // Check if feature is enabled
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const enabled = config.get('enabled', true) as boolean;
  
  if (!enabled) {
    throw new Error('PR Description Generator is disabled');
  }
  
  // Step 1: Get Git information
  const currentBranch = await getCurrentBranch();
  
  progress.report({ message: 'Extracting JIRA key from branch...', increment: 10 });
  
  // Step 2: Extract JIRA key
  const jiraKey = extractJiraKeyFromBranch(currentBranch);
  
  // Step 3: Fetch JIRA issue
  let jiraIssue;
  if (jiraKey) {
    progress.report({ message: `Fetching JIRA issue ${jiraKey}...`, increment: 10 });
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
  
  progress.report({ message: 'Analyzing commits and changes...', increment: 15 });
  
  // Step 4: Get commit log and file changes from current branch
  const prConfig = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const maxCommits = prConfig.get('maxCommits', 50) as number;
  const commits = await getCommitLog(maxCommits);
  const fileChanges = await getFileChanges(commits);
  
  if (commits.length === 0) {
    throw new Error(
      `No commits found on the current branch '${currentBranch}'.\n\n` +
      `Make sure you have commits on your branch to generate a PR description.`
    );
  }
  
  progress.report({ message: 'Detecting project language...', increment: 10 });
  
  // Step 5: Detect language
  const workspaceRoot = await getRepositoryRoot();
  const language = await detectProjectLanguage(workspaceRoot);
  
  progress.report({ message: 'Detecting test coverage...', increment: 10 });
  
  // Step 6: Detect coverage
  let coverage;
  try {
    coverage = await detectCoverage(workspaceRoot, language);
  } catch (error) {
    // Coverage detection failed - continue without coverage info
    coverage = null;
  }
  
  progress.report({ message: 'Generating PR sections...', increment: 15 });
  
  // Build context
  const context: PRContext = {
    currentBranch,
    baseBranch: undefined, // No base branch needed - analyzing current branch commits
    jiraKey: jiraKey || undefined,
    jiraIssue,
    commits,
    fileChanges,
    language,
    coverage: coverage || undefined
  };
  
  progress.report({ message: 'Generating PR description with Copilot...', increment: 10 });
  
  // Get template and generate prompt
  const template = config.get('promptTemplate', '') as string;
  const prompt = fillPRTemplate(template, context);
  
  // Generate with Copilot
  const autoSubmit = config.get('autoSubmit', false) as boolean;
  let description = await generateWithCopilot(prompt, autoSubmit);
  
  // If autoSubmit or manual mode, description will be empty
  if (!description) {
    throw new Error(
      'Please review the PR description generated in Copilot Chat, then copy it to continue.\n\n' +
      'The description has been ' + (autoSubmit ? 'submitted to' : 'pasted into') + ' Copilot Chat for your review.'
    );
  }
  
  progress.report({ message: 'Validating description...', increment: 5 });
  
  progress.report({ message: 'Finalizing...', increment: 5 });
  
  // Build result (no validation or scoring)
  const result: PRGenerationResult = {
    description,
    validation: {
      isValid: true,
      score: 0,
      summary: { isValid: true, length: 0, issues: [] },
      changes: { isValid: true, length: 0, issues: [] },
      testing: { isValid: true, length: 0, issues: [] },
      impact: { isValid: true, length: 0, issues: [] },
      notes: { isValid: true, length: 0, issues: [] },
      warnings: []
    },
    estimatedScore: 0,
    metadata: {
      commitsAnalyzed: commits.length,
      filesChanged: fileChanges.length,
      jiraAligned: !!jiraIssue,
      language: language?.language || 'unknown',
      coverageDetected: !!coverage
    }
  };
  
  return result;
}
