import * as vscode from 'vscode';
import { getPRReviewConfigWithTeamDefaults } from '../aiConfigManager';
import { reviewPRWithProgress } from '../pr/prReview';
import { getRepositoryRoot } from '../pr/gitOperations';

/**
 * Command handler for PR Review
 */
export async function prReviewCommand() {
  try {
    const config = vscode.workspace.getConfiguration('jiraSmartCommit.prReview');
    const enabled = config.get('enabled', true) as boolean;

    if (!enabled) {
      vscode.window.showWarningMessage(
        'PR Review is disabled. Enable it in settings: jiraSmartCommit.prReview.enabled'
      );
      return;
    }

    let cwd: string | undefined;
    try {
      cwd = await getRepositoryRoot();
    } catch (error) {
      console.warn('Could not get repository root:', error);
    }

    const prReviewConfig = getPRReviewConfigWithTeamDefaults(cwd);
    const autoSubmit = prReviewConfig.autoSubmit;

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Reviewing PR',
          cancellable: false
        },
        async (progress) => {
          return await reviewPRWithProgress(progress);
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('Copilot Chat')) {
        const mode = autoSubmit ? 'submitted' : 'pasted';
        const isMac = process.platform === 'darwin';
        const copyKey = isMac ? 'Cmd+C' : 'Ctrl+C';

        vscode.window.showInformationMessage(
          `✓ PR review prompt ${mode} to Copilot Chat.\n\n` +
          `Next steps:\n` +
          `1. Review the PR review in Copilot Chat\n` +
          `2. Copy the response manually (${copyKey})\n` +
          `3. Apply the feedback before creating the PR`
        );
      } else {
        throw error;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to review PR: ${message}`);
    console.error('PR review error:', error);
  }
}
