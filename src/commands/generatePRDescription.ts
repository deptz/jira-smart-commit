import * as vscode from 'vscode';
import { generatePRDescriptionWithProgress } from '../pr/prGenerator';
import { getPRConfigWithTeamDefaults } from '../aiConfigManager';
import { extractJiraKeyFromBranch, getCurrentBranch, getRepositoryRoot } from '../pr/gitOperations';
import { checkPrerequisites } from '../pr/prPrerequisites';
import { buildTempPRDescriptionTemplate, writeTempPRDescriptionFile } from '../pr/tempPRFile';

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
    
    // Get repository root for team config
    let cwd: string | undefined;
    try {
      cwd = await getRepositoryRoot();
    } catch (error) {
      // If we can't get repository root, continue without it
      console.warn('Could not get repository root:', error);
    }
    
    // Load config with team defaults
    const prConfig = getPRConfigWithTeamDefaults(cwd);
    const requirePrerequisites = prConfig.requirePrerequisites;
    
    // Check prerequisites if enabled
    if (requirePrerequisites) {
      try {
        const branchName = await getCurrentBranch();
        const prerequisites = await checkPrerequisites(branchName);
        
        if (!prerequisites.met) {
          const missingList = prerequisites.missing.join(' and ');
          vscode.window.showErrorMessage(
            `PR Description generation requires prerequisites to be completed first.\n\n` +
            `Missing: ${missingList}\n\n` +
            `Please run:\n` +
            `- 'JIRA Smart Commit: Review Security' (if missing)\n` +
            `- 'JIRA Smart Commit: Enforce Test Coverage' (if missing)\n\n` +
            `You can disable this requirement in settings: jiraSmartCommit.pr.requirePrerequisites`
          );
          return;
        }
      } catch (error) {
        // If we can't check prerequisites (e.g., no branch), show warning but continue
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn('Could not check prerequisites:', errorMsg);
        vscode.window.showWarningMessage(
          `Could not verify prerequisites: ${errorMsg}. Proceeding with PR generation.`
        );
      }
    }
    
    const autoSubmit = prConfig.autoSubmit;

    const createAction = 'Create Bitbucket PR from temp file';
    const currentBranch = await getCurrentBranch();
    const jiraKey = extractJiraKeyFromBranch(currentBranch) || undefined;
    const tempTemplate = buildTempPRDescriptionTemplate({
      sourceBranch: currentBranch,
      jiraKey,
    });
    const tempFile = writeTempPRDescriptionFile(cwd || (await getRepositoryRoot()), tempTemplate);
    const tempDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile.path));
    await vscode.window.showTextDocument(tempDoc, { preview: false });

    if (tempFile.overwritten) {
      vscode.window.showWarningMessage(
        `Overwrote existing temporary file: ${tempFile.path}`
      );
    }

    // Show progress while generating prompt/context in Copilot
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
      
      const picked = await vscode.window.showInformationMessage(
        `PR description prompt generated. Paste Copilot output into ${tempFile.path}, then create PR.`,
        createAction
      );
      if (picked === createAction) {
        await vscode.commands.executeCommand('jiraSmartCommit.createBitbucketPRFromTempFile');
      }
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
          `1. Review generated description in Copilot Chat\n` +
          `2. Copy response manually (${copyKey})\n` +
          `3. Paste it into ${tempFile.path}\n` +
          `4. Run 'JIRA Smart Commit: Create Bitbucket PR from Temp File'`
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
