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
  const normalizedType = issueType.toLowerCase().replace(/[\s-]/g, '');
  
  // Check if it's a bug-related issue
  if (normalizedType.includes('bug') || 
      normalizedType.includes('defect') || 
      normalizedType.includes('fasttrack') || 
      normalizedType.includes('incident')) {
    return bugTemplate;
  }
  
  // Default to task template for Story, Task, Sub-task, Epic, etc.
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
  const context = (global as any).extensionContext as vscode.ExtensionContext | undefined;
  
  if (!context) {
    vscode.window.showErrorMessage('Extension context not available. Please try again.');
    return;
  }
  
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
    
    // Send usage tracking data (team gateway only, fire-and-forget)
    try {
      const { sendTrackingData } = await import('../telemetry');
      const { randomUUID } = await import('crypto');
      const repositoryName = repoInfo.cwd.split('/').pop() || 'unknown';
      const fullConfig = getConfig(repoInfo.cwd);
      
      // Determine template type based on issue type
      const templateType: 'task' | 'bug' = 
        issueType.toLowerCase().includes('bug') || 
        issueType.toLowerCase().includes('defect') || 
        issueType.toLowerCase().includes('fasttrack') || 
        issueType.toLowerCase().includes('incident') ? 'bug' : 'task';
      
      await sendTrackingData(context, {
        metadataVersion: '1.0',
        feature: 'firstPrompt',
        user: cfg.email,
        timestamp: new Date().toISOString(),
        requestId: randomUUID(),
        jiraKey: jiraKey,
        repository: repositoryName,
        branch: branchName,
        issueType: issueType,
        templateType: templateType
      }, {
        enableUsageTracking: fullConfig.enableUsageTracking,
        trackingUrl: fullConfig.trackingUrl,
        trackingRequiresAuth: fullConfig.trackingRequiresAuth,
        anonymizeUser: fullConfig.anonymizeUser
      });
    } catch (error) {
      // Tracking should never disrupt the main flow - fail silently
    }
    
    // Step 7: Fill template with JIRA description
    const prompt = fillTemplate(template, issue.description, issue.summary, issue.key);
    
    // Step 8: Submit prompt based on configuration
    const promptCfg = vscode.workspace.getConfiguration('jiraSmartCommit.firstPrompt');
    const autoSubmit = promptCfg.get<boolean>('autoSubmit', true);
    
    if (autoSubmit) {
      // Auto-submit: Send prompt directly to GitHub Copilot Chat and submit
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt
      });
      vscode.window.showInformationMessage(`✓ First prompt submitted to Copilot Chat for ${jiraKey} (${issueType})`);
    } else {
      // Manual mode: Copy to clipboard and open chat - user can paste with Cmd/Ctrl+V
      await vscode.env.clipboard.writeText(prompt);
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      
      // Small delay to ensure chat panel is focused
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Paste from clipboard into the chat input
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
      
      vscode.window.showInformationMessage(`✓ First prompt pasted to Copilot Chat for ${jiraKey} (${issueType}). Review and press Enter to submit.`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to generate first prompt: ${errorMessage}`);
    console.error('First Prompt Generator Error:', error);
  }
}
