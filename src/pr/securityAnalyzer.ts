import * as vscode from 'vscode';
import { getCurrentBranch, getRepositoryRoot, clearRepositoryCache } from './gitOperations';
import { getSecurityConfigWithTeamDefaults } from '../aiConfigManager';
import { buildSecurityTemplateContext, tryFetchJiraIssueFromBranch } from '../orchestrator/contextBuilders';
import { renderPromptTemplate } from '../orchestrator/promptRenderer';

/**
 * Generate security review prompt using GitHub Copilot Chat
 */
async function generateWithCopilot(prompt: string, autoSubmit: boolean): Promise<string> {
  if (autoSubmit) {
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: prompt,
    });
    return '';
  }

  await vscode.env.clipboard.writeText(prompt);
  await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  return '';
}

/**
 * Review security with progress reporting
 */
export async function reviewSecurityWithProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<void> {
  progress.report({ message: 'Analyzing Git repository...', increment: 10 });

  clearRepositoryCache();

  const config = vscode.workspace.getConfiguration('jiraSmartCommit.security');
  const enabled = config.get('enabled', true) as boolean;

  if (!enabled) {
    throw new Error('Security Review is disabled');
  }

  const currentBranch = await getCurrentBranch();
  const workspaceRoot = await getRepositoryRoot();

  progress.report({ message: 'Extracting JIRA key from branch...', increment: 10 });

  // Optional JIRA fetch is preserved for backward-compatible behavior and future context extension.
  const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
  await tryFetchJiraIssueFromBranch(currentBranch, jiraConfig.get('fetchRelatedIssues', false) as boolean);

  progress.report({ message: 'Generating diffs for all commits on branch...', increment: 15 });

  const securityConfig = getSecurityConfigWithTeamDefaults(workspaceRoot);
  const securityContext = await buildSecurityTemplateContext(workspaceRoot);

  progress.report({ message: 'Building security review prompt...', increment: 25 });

  const template = securityConfig.promptTemplate;
  if (!template) {
    throw new Error('Security review prompt template is not configured. Please set jiraSmartCommit.security.promptTemplate');
  }

  const prompt = renderPromptTemplate(template, {
    RECENT_COMMITS_DIFF: securityContext.recentCommitsDiff,
    STAGED_CHANGES_DIFF: securityContext.stagedChangesDiff,
    FRAMEWORK_CONTEXT: securityContext.frameworkContext,
  });

  progress.report({ message: 'Sending to Copilot Chat...', increment: 10 });

  const autoSubmit = securityConfig.autoSubmit;
  const result = await generateWithCopilot(prompt, autoSubmit);

  if (!result) {
    throw new Error(
      'Please review the security analysis generated in Copilot Chat, then copy it to continue.\n\n' +
        'The security review has been ' +
        (autoSubmit ? 'submitted to' : 'pasted into') +
        ' Copilot Chat for your review.'
    );
  }

  progress.report({ message: 'Complete', increment: 5 });
}
