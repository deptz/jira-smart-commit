import * as vscode from 'vscode';
import { PRGenerationResult } from './types';
import { clearRepositoryCache } from './gitOperations';
import { getPRConfigWithTeamDefaults } from '../aiConfigManager';
import { buildPRRuntimeContext, buildPRTemplateContext } from '../orchestrator/contextBuilders';
import { renderPromptTemplate } from '../orchestrator/promptRenderer';

/**
 * Generate PR description using GitHub Copilot Chat
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

function buildResultFromContext(input: {
  description: string;
  commitsAnalyzed: number;
  filesChanged: number;
  jiraAligned: boolean;
  language: string;
  coverageDetected: boolean;
}): PRGenerationResult {
  return {
    description: input.description,
    validation: {
      isValid: true,
      score: 0,
      summary: { isValid: true, length: 0, issues: [] },
      changes: { isValid: true, length: 0, issues: [] },
      testing: { isValid: true, length: 0, issues: [] },
      impact: { isValid: true, length: 0, issues: [] },
      notes: { isValid: true, length: 0, issues: [] },
      warnings: [],
    },
    estimatedScore: 0,
    metadata: {
      commitsAnalyzed: input.commitsAnalyzed,
      filesChanged: input.filesChanged,
      jiraAligned: input.jiraAligned,
      language: input.language,
      coverageDetected: input.coverageDetected,
    },
  };
}

async function buildAndGeneratePRDescription(): Promise<PRGenerationResult> {
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const enabled = config.get('enabled', true) as boolean;

  if (!enabled) {
    throw new Error('PR Description Generator is disabled. Enable it in settings: jiraSmartCommit.pr.enabled');
  }

  const maxCommits = config.get('maxCommits', 50) as number;
  const runtime = await buildPRRuntimeContext(maxCommits);
  const { context, workspaceRoot, currentBranch, jiraKey } = runtime;

  if (context.commits.length === 0) {
    throw new Error(
      `No commits found on the current branch '${context.currentBranch}'.\n\n` +
        'Make sure you have commits on your branch to generate a PR description.'
    );
  }

  // Send usage tracking data (team gateway only, fire-and-forget)
  try {
    const { sendTrackingData } = await import('../telemetry');
    const { getConfig } = await import('../utils');
    const { randomUUID } = await import('crypto');
    const extensionContext = (global as any).extensionContext as vscode.ExtensionContext | undefined;
    const repositoryName = workspaceRoot.split('/').pop() || 'unknown';

    if (extensionContext) {
      const cfg = getConfig(workspaceRoot);
      const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
      const userEmail = jiraConfig.get('email', '') as string;

      await sendTrackingData(
        extensionContext,
        {
          metadataVersion: '1.0',
          feature: 'pr',
          user: userEmail,
          timestamp: new Date().toISOString(),
          requestId: randomUUID(),
          jiraKey: jiraKey || undefined,
          repository: repositoryName,
          branch: currentBranch,
          commitsAnalyzed: context.commits.length,
          filesChanged: context.fileChanges.length,
          language: context.language?.language,
          coverageDetected: !!context.coverage,
        },
        {
          enableUsageTracking: cfg.enableUsageTracking,
          trackingUrl: cfg.trackingUrl,
          trackingRequiresAuth: cfg.trackingRequiresAuth,
          anonymizeUser: cfg.anonymizeUser,
        }
      );
    }
  } catch {
    // Tracking should never disrupt the main flow - fail silently
  }

  const prConfig = getPRConfigWithTeamDefaults(workspaceRoot);
  const prompt = renderPromptTemplate(prConfig.promptTemplate, buildPRTemplateContext(context));
  const description = await generateWithCopilot(prompt, prConfig.autoSubmit);

  if (!description) {
    throw new Error(
      'Please review the PR description generated in Copilot Chat, then copy it to continue.\n\n' +
        'The description has been ' +
        (prConfig.autoSubmit ? 'submitted to' : 'pasted into') +
        ' Copilot Chat for your review.'
    );
  }

  return buildResultFromContext({
    description,
    commitsAnalyzed: context.commits.length,
    filesChanged: context.fileChanges.length,
    jiraAligned: !!context.jiraIssue,
    language: context.language?.language || 'unknown',
    coverageDetected: !!context.coverage,
  });
}

/**
 * Main function to generate PR description
 */
export async function generatePRDescription(): Promise<PRGenerationResult> {
  clearRepositoryCache();
  return buildAndGeneratePRDescription();
}

/**
 * Generate PR description with progress reporting
 */
export async function generatePRDescriptionWithProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<PRGenerationResult> {
  progress.report({ message: 'Analyzing Git repository...', increment: 20 });

  clearRepositoryCache();

  progress.report({ message: 'Collecting PR context...', increment: 30 });

  const result = await buildAndGeneratePRDescription();

  progress.report({ message: 'Finalizing...', increment: 50 });

  return result;
}
