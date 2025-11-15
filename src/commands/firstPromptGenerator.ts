import * as vscode from 'vscode';
import { fetchIssue } from '../jiraClient';
import { getConfig, ensureApiToken, pickRepository } from '../utils';

/**
 * Extracts JIRA key from the current branch name
 */
function extractJiraKeyFromBranch(branchName: string): string | undefined {
  try {
    const cfg = getConfig();
    const regex = new RegExp(cfg.branchPattern);
    const match = regex.exec(branchName);
    const key = match?.groups?.['key'] ?? match?.[1];
    return key;
  } catch (error) {
    return undefined;
  }
}

/**
 * Gets the template configuration based on issue type
 */
function getTemplateForIssueType(issueType: string): string {
  const cfg = vscode.workspace.getConfiguration('jiraSmartCommit.firstPrompt');
  const taskTemplate = cfg.get<string>('taskTemplate', '');
  const bugTemplate = cfg.get<string>('bugTemplate', '');
  
  // Normalize issue type to lowercase for comparison
  const normalizedType = issueType.toLowerCase();
  
  // Check if it's a bug
  if (normalizedType.includes('bug') || normalizedType.includes('defect')) {
    return bugTemplate;
  }
  
  // Default to task template for Story, Task, Epic, etc.
  return taskTemplate;
}

/**
 * Replaces {{DESCRIPTION}} placeholder with actual JIRA description
 */
function fillTemplate(template: string, description: string, summary: string, key: string): string {
  // Create a formatted description with key, summary, and full description
  const formattedDescription = `**JIRA Key:** ${key}\n**Summary:** ${summary}\n\n**Description:**\n${description}`;
  
  return template.replace(/\{\{DESCRIPTION\}\}/g, formattedDescription);
}

/**
 * Main command function for First Prompt Generator
 */
export async function firstPromptGeneratorCommand(): Promise<void> {
  const context = (global as any).extensionContext as vscode.ExtensionContext;
  
  try {
    // Step 1: Get repository
    const repoInfo = await pickRepository();
    if (!repoInfo) {
      vscode.window.showErrorMessage('No Git repository found or selected.');
      return;
    }
    
    // Step 2: Get current branch name
    const head = repoInfo.repo.state.HEAD;
    if (!head || !head.name) {
      vscode.window.showErrorMessage('Could not determine current branch.');
      return;
    }
    
    const branchName = head.name;
    
    // Step 3: Extract JIRA key from branch
    const jiraKey = extractJiraKeyFromBranch(branchName);
    if (!jiraKey) {
      vscode.window.showWarningMessage(`Could not extract JIRA key from branch name "${branchName}". Please ensure your branch follows the naming pattern (e.g., ABC-123-description or feature/ABC-123-description).`);
      return;
    }
    
    vscode.window.showInformationMessage(`Found JIRA key: ${jiraKey}`);
    
    // Step 3: Get JIRA configuration
    const cfg = getConfig();
    if (!cfg.baseUrl || !cfg.email) {
      vscode.window.showErrorMessage('JIRA configuration incomplete. Please configure baseUrl and email in settings.');
      return;
    }
    
    // Step 4: Ensure API token is available
    const apiToken = await ensureApiToken(context);
    if (!apiToken) {
      vscode.window.showErrorMessage('JIRA API token not found. Please configure it first.');
      return;
    }
    
    // Step 5: Fetch issue from JIRA
    vscode.window.showInformationMessage('Fetching JIRA issue details...');
    const issue = await fetchIssue({
      key: jiraKey,
      baseUrl: cfg.baseUrl,
      email: cfg.email,
      apiToken: apiToken,
      fetchRelatedIssues: false
    });
    
    // Step 6: Check issue type and get appropriate template
    const issueType = issue.issueType || 'Task';
    const template = getTemplateForIssueType(issueType);
    
    // Step 7: Fill template with JIRA description
    const prompt = fillTemplate(template, issue.description, issue.summary, issue.key);
    
    // Step 8: Send prompt to GitHub Copilot Chat
    // Using the VS Code Chat API to pre-fill the chat input
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    
    // Insert the prompt into the chat input
    // Note: This uses the chat participant API
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: prompt
    });
    
    vscode.window.showInformationMessage(`✓ First prompt generated for ${jiraKey} (${issueType})`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to generate first prompt: ${errorMessage}`);
    console.error('First Prompt Generator Error:', error);
  }
}
