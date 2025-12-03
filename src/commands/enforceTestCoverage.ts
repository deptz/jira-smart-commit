import * as vscode from 'vscode';
import { pickRepository } from '../utils';
import { getTestCoverageConfigWithTeamDefaults } from '../aiConfigManager';
import { markTestCoverageCompleted } from '../pr/prPrerequisites';

/**
 * Main command function for Enforce Test Coverage
 */
export async function enforceTestCoverageCommand(): Promise<void> {
  try {
    // Step 1: Check if feature is enabled
    const config = vscode.workspace.getConfiguration('jiraSmartCommit.testCoverage');
    const enabled = config.get<boolean>('enabled', true);
    
    if (!enabled) {
      vscode.window.showWarningMessage(
        'Test Coverage Enforcement is disabled. Enable it in settings: jiraSmartCommit.testCoverage.enabled'
      );
      return;
    }
    
    // Step 2: Get repository
    const repoInfo = await pickRepository();
    if (!repoInfo) {
      vscode.window.showErrorMessage('No Git repository found or selected.');
      return;
    }
    
    // Step 3: Get current branch name
    const head = repoInfo.repo.state.HEAD;
    if (!head || !head.name) {
      vscode.window.showErrorMessage('Could not determine current branch.');
      return;
    }
    
    const branchName = head.name;
    
    // Step 4: Load prompt template from config (user settings > team config > default)
    const testCoverageConfig = getTestCoverageConfigWithTeamDefaults(repoInfo.cwd);
    const promptTemplate = testCoverageConfig.promptTemplate;
    
    if (!promptTemplate || promptTemplate.trim() === '') {
      vscode.window.showErrorMessage(
        'Test coverage prompt template is not configured. Please set jiraSmartCommit.testCoverage.promptTemplate in settings or .jira-smart-commit.json'
      );
      return;
    }
    
    // Step 5: Get autoSubmit setting
    const autoSubmit = testCoverageConfig.autoSubmit;
    
    // Step 6: Submit prompt to GitHub Copilot Chat
    if (autoSubmit) {
      // Auto-submit: Send prompt directly to GitHub Copilot Chat and submit
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: promptTemplate
      });
      
      // Mark test coverage as completed for this branch
      try {
        await markTestCoverageCompleted(branchName);
      } catch (error) {
        // If we can't mark as completed, log warning but continue
        console.warn('Could not mark test coverage as completed:', error);
      }
      
      vscode.window.showInformationMessage(`✓ Test coverage enforcement prompt submitted to Copilot Chat for branch ${branchName}`);
    } else {
      // Manual mode: Copy to clipboard and open chat - user can paste with Cmd/Ctrl+V
      await vscode.env.clipboard.writeText(promptTemplate);
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      
      // Small delay to ensure chat panel is focused
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Paste from clipboard into the chat input
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
      
      // Mark test coverage as completed for this branch
      try {
        await markTestCoverageCompleted(branchName);
      } catch (error) {
        // If we can't mark as completed, log warning but continue
        console.warn('Could not mark test coverage as completed:', error);
      }
      
      vscode.window.showInformationMessage(`✓ Test coverage enforcement prompt pasted to Copilot Chat for branch ${branchName}. Review and press Enter to submit.`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to enforce test coverage: ${errorMessage}`);
    console.error('Test Coverage Enforcement Error:', error);
  }
}

