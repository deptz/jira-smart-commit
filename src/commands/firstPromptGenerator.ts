import * as vscode from 'vscode';
import { fetchIssue } from '../jiraClient';
import { getConfig, ensureApiToken, pickRepository } from '../utils';
import { getFirstPromptConfigWithTeamDefaults } from '../aiConfigManager';
import { buildFirstPromptTemplateContext, selectFirstPromptTemplateType } from '../orchestrator/contextBuilders';
import { renderPromptTemplate } from '../orchestrator/promptRenderer';

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
  } catch {
    return undefined;
  }
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
    const repoInfo = await pickRepository();
    if (!repoInfo) {
      vscode.window.showErrorMessage('No Git repository found or selected.');
      return;
    }

    const head = repoInfo.repo.state.HEAD;
    if (!head || !head.name) {
      vscode.window.showErrorMessage('Could not determine current branch.');
      return;
    }

    const branchName = head.name;
    const jiraKey = extractJiraKeyFromBranch(branchName);
    if (!jiraKey) {
      vscode.window.showWarningMessage(
        `Could not extract JIRA key from branch name "${branchName}". Please ensure your branch follows the naming pattern (e.g., ABC-123-description or feature/ABC-123-description).`
      );
      return;
    }

    vscode.window.showInformationMessage(`Found JIRA key: ${jiraKey}`);

    const cfg = getConfig();
    if (!cfg.baseUrl || !cfg.email) {
      vscode.window.showErrorMessage('JIRA configuration incomplete. Please configure baseUrl and email in settings.');
      return;
    }

    const apiToken = await ensureApiToken(context);
    if (!apiToken) {
      vscode.window.showErrorMessage('JIRA API token not found. Please configure it first.');
      return;
    }

    vscode.window.showInformationMessage('Fetching JIRA issue details...');
    const issue = await fetchIssue({
      key: jiraKey,
      baseUrl: cfg.baseUrl,
      email: cfg.email,
      apiToken,
      fetchRelatedIssues: false,
    });

    const issueType = issue.issueType || 'Task';
    const templateType = selectFirstPromptTemplateType(issueType);
    const firstPromptConfig = getFirstPromptConfigWithTeamDefaults(repoInfo.cwd);
    const template = templateType === 'bug' ? firstPromptConfig.bugTemplate : firstPromptConfig.taskTemplate;

    // Send usage tracking data (team gateway only, fire-and-forget)
    try {
      const { sendTrackingData } = await import('../telemetry');
      const { randomUUID } = await import('crypto');
      const repositoryName = repoInfo.cwd.split('/').pop() || 'unknown';
      const fullConfig = getConfig(repoInfo.cwd);

      await sendTrackingData(
        context,
        {
          metadataVersion: '1.0',
          feature: 'firstPrompt',
          user: cfg.email,
          timestamp: new Date().toISOString(),
          requestId: randomUUID(),
          jiraKey,
          repository: repositoryName,
          branch: branchName,
          issueType,
          templateType,
        },
        {
          enableUsageTracking: fullConfig.enableUsageTracking,
          trackingUrl: fullConfig.trackingUrl,
          trackingRequiresAuth: fullConfig.trackingRequiresAuth,
          anonymizeUser: fullConfig.anonymizeUser,
        }
      );
    } catch {
      // Tracking should never disrupt the main flow - fail silently
    }

    const prompt = renderPromptTemplate(template, buildFirstPromptTemplateContext(issue));
    const autoSubmit = firstPromptConfig.autoSubmit;

    if (autoSubmit) {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt,
      });
      vscode.window.showInformationMessage(`✓ First prompt submitted to Copilot Chat for ${jiraKey} (${issueType})`);
    } else {
      await vscode.env.clipboard.writeText(prompt);
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      await new Promise((resolve) => setTimeout(resolve, 100));
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');

      vscode.window.showInformationMessage(
        `✓ First prompt pasted to Copilot Chat for ${jiraKey} (${issueType}). Review and press Enter to submit.`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to generate first prompt: ${errorMessage}`);
    console.error('First Prompt Generator Error:', error);
  }
}
