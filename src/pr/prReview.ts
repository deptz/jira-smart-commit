import * as vscode from 'vscode';
import {
  clearRepositoryCache,
  extractJiraKeyFromBranch,
  getBaseBranch,
  getCurrentBranch,
  getRepositoryRoot
} from './gitOperations';
import { detectProjectLanguage } from './languageDetector';
import { fetchIssue } from '../jiraClient';
import { JiraIssue } from '../types';
import { getPRReviewConfigWithTeamDefaults } from '../aiConfigManager';

/**
 * PR review context for building the review prompt
 */
export type PRReviewContext = {
  frameworkContext?: string;
  currentBranch: string;
  baseBranch?: string;
  jiraKey?: string;
  jiraIssue?: JiraIssue;
};

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

function fillPRReviewTemplate(template: string, context: PRReviewContext): string {
  let filled = template;

  const frameworkContext = context.frameworkContext || '(not detected)';
  filled = filled.replace(/\{\{FRAMEWORK_CONTEXT\}\}/g, frameworkContext);

  const baseBranch = context.baseBranch || '(not detected)';
  filled = filled.replace(/\{\{BASE_BRANCH\}\}/g, baseBranch);

  const jiraKey = context.jiraKey || '(not detected)';
  filled = filled.replace(/\{\{JIRA_KEY\}\}/g, jiraKey);

  const jiraSummary = context.jiraIssue?.summary || '(not available)';
  filled = filled.replace(/\{\{JIRA_SUMMARY\}\}/g, jiraSummary);

  const jiraDescription = context.jiraIssue?.description || '(not available)';
  filled = filled.replace(/\{\{JIRA_DESCRIPTION\}\}/g, jiraDescription);

  return filled;
}

async function generateWithCopilot(prompt: string, autoSubmit: boolean): Promise<string> {
  if (autoSubmit) {
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: prompt
    });
    return '';
  }

  await vscode.env.clipboard.writeText(prompt);
  await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
  await new Promise(resolve => setTimeout(resolve, 100));
  await vscode.commands.executeCommand('editor.action.clipboardPasteAction');

  return '';
}

/**
 * Review PR with progress reporting
 */
export async function reviewPRWithProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<void> {
  progress.report({ message: 'Analyzing Git repository...', increment: 10 });

  clearRepositoryCache();

  const config = vscode.workspace.getConfiguration('jiraSmartCommit.prReview');
  const enabled = config.get('enabled', true) as boolean;

  if (!enabled) {
    throw new Error('PR Review is disabled');
  }

  const currentBranch = await getCurrentBranch();
  const workspaceRoot = await getRepositoryRoot();

  progress.report({ message: 'Detecting base branch...', increment: 5 });
  const baseBranch = await getBaseBranch(currentBranch);

  progress.report({ message: 'Extracting JIRA key from branch...', increment: 5 });
  const jiraKey = extractJiraKeyFromBranch(currentBranch);

  let jiraIssue: JiraIssue | undefined;
  if (jiraKey) {
    progress.report({ message: `Fetching JIRA issue ${jiraKey}...`, increment: 5 });
    try {
      const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
      const baseUrl = jiraConfig.get('baseUrl') as string;
      const email = jiraConfig.get('email') as string;
      const context = (global as any).extensionContext;
      const apiToken = await context?.secrets.get('jiraSmartCommit.jira.apiToken');
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

  progress.report({ message: 'Detecting framework context...', increment: 20 });
  const frameworkContext = await buildFrameworkContext(workspaceRoot);

  progress.report({ message: 'Building PR review prompt...', increment: 10 });
  const prReviewConfig = getPRReviewConfigWithTeamDefaults(workspaceRoot);
  const template = prReviewConfig.promptTemplate;
  if (!template) {
    throw new Error('PR review prompt template is not configured. Please set jiraSmartCommit.prReview.promptTemplate');
  }

  const reviewContext: PRReviewContext = {
    frameworkContext,
    currentBranch,
    baseBranch,
    jiraKey: jiraKey || undefined,
    jiraIssue
  };

  const prompt = fillPRReviewTemplate(template, reviewContext);

  progress.report({ message: 'Sending to Copilot Chat...', increment: 10 });
  const result = await generateWithCopilot(prompt, prReviewConfig.autoSubmit);

  if (!result) {
    throw new Error(
      'Please review the PR review generated in Copilot Chat, then copy it to continue.\n\n' +
      'The PR review has been ' + (prReviewConfig.autoSubmit ? 'submitted to' : 'pasted into') + ' Copilot Chat for your review.'
    );
  }

  progress.report({ message: 'Complete', increment: 5 });
}
