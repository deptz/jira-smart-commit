import * as vscode from 'vscode';
import { reviewSecurityWithProgress } from '../pr/securityAnalyzer';
import { getCurrentBranch } from '../pr/gitOperations';
import { markSecurityCompleted } from '../pr/prPrerequisites';

/**
 * Command handler for Security Review
 */
export async function reviewSecurityCommand() {
  try {
    // Check if security feature is enabled
    const config = vscode.workspace.getConfiguration('jiraSmartCommit.security');
    const enabled = config.get('enabled', true) as boolean;
    
    if (!enabled) {
      vscode.window.showWarningMessage(
        'Security Review is disabled. Enable it in settings: jiraSmartCommit.security.enabled'
      );
      return;
    }
    
    const autoSubmit = config.get('autoSubmit', false) as boolean;
    
    // Show progress while generating
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Reviewing Security',
          cancellable: false
        },
        async (progress) => {
          return await reviewSecurityWithProgress(progress);
        }
      );
      
      // If we reach here, security review succeeded but we don't use the result
      // because the user needs to copy from Copilot Chat manually
    } catch (error) {
      // Check if this is the expected "please copy from Copilot" error
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('Copilot Chat')) {
        // This is expected - show helpful message with next steps
        const mode = autoSubmit ? 'submitted' : 'pasted';
        const isMac = process.platform === 'darwin';
        const copyKey = isMac ? 'Cmd+C' : 'Ctrl+C';
        
        // Mark security review as completed for this branch
        try {
          const branchName = await getCurrentBranch();
          await markSecurityCompleted(branchName);
        } catch (error) {
          // If we can't mark as completed (e.g., no branch), log warning but continue
          console.warn('Could not mark security as completed:', error);
        }
        
        vscode.window.showInformationMessage(
          `✓ Security review prompt ${mode} to Copilot Chat.\n\n` +
          `Next steps:\n` +
          `1. Review the security analysis in Copilot Chat\n` +
          `2. Copy the response manually (${copyKey})\n` +
          `3. Address any security findings before committing`
        );
      } else {
        // Unexpected error
        throw error;
      }
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to review security: ${message}`);
    console.error('Security review error:', error);
  }
}


