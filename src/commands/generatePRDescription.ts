import * as vscode from 'vscode';
import { generatePRDescriptionWithProgress } from '../pr/prGenerator';

/**
 * Command handler for Generate PR Description
 */
export async function generatePRDescriptionCommand() {
  try {
    // Check if PR feature is enabled
    const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
    const enabled = config.get('enabled', true) as boolean;
    
    if (!enabled) {
      vscode.window.showWarningMessage(
        'PR Description Generator is disabled. Enable it in settings: jiraSmartCommit.pr.enabled'
      );
      return;
    }
    
    const autoSubmit = config.get('autoSubmit', false) as boolean;
    
    // Show progress while generating
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating PR Description',
          cancellable: false
        },
        async (progress) => {
          return await generatePRDescriptionWithProgress(progress);
        }
      );
      
      // If we reach here, description generation succeeded but we don't use the result
      // because the user needs to copy from Copilot Chat manually
    } catch (error) {
      // Check if this is the expected "please copy from Copilot" error
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('Copilot Chat')) {
        // This is expected - show helpful message with next steps
        const mode = autoSubmit ? 'submitted' : 'pasted';
        const isMac = process.platform === 'darwin';
        const copyKey = isMac ? 'Cmd+C' : 'Ctrl+C';
        
        vscode.window.showInformationMessage(
          `✓ PR description prompt ${mode} to Copilot Chat.\n\n` +
          `Next steps:\n` +
          `1. Review the generated description in Copilot Chat\n` +
          `2. Copy the response manually (${copyKey})\n` +
          `3. Paste into your PR when ready`
        );
      } else {
        // Unexpected error
        throw error;
      }
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to generate PR description: ${message}`);
    console.error('PR generation error:', error);
  }
}
