import * as vscode from 'vscode';
import { generatePRDescriptionWithProgress } from '../pr/prGenerator';
import { getScoreGrade, getScoreEmoji, getScoreDescription } from '../pr/scoreCalculator';
import { meetsQualityStandards } from '../pr/prValidator';

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
    
    // Show progress while generating
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating PR Description',
        cancellable: false
      },
      async (progress) => {
        return await generatePRDescriptionWithProgress(progress);
      }
    );
    
    // Check quality score
    const minScore = config.get('minScore', 85) as number;
    const meetsStandards = meetsQualityStandards(result.validation, minScore);
    
    // Build result message
    const emoji = getScoreEmoji(result.estimatedScore);
    const grade = getScoreGrade(result.estimatedScore);
    const description = getScoreDescription(result.estimatedScore);
    
    const scoreMessage = `${emoji} Quality Score: ${result.estimatedScore}/100 (Grade ${grade})`;
    const statusMessage = meetsStandards 
      ? '✅ Meets quality standards'
      : `⚠️ Below minimum score of ${minScore}`;
    
    // Show result dialog
    const actions = ['Copy to Clipboard', 'View Details'];
    if (result.validation.warnings.length > 0) {
      actions.push('View Warnings');
    }
    actions.push('Cancel');
    
    const choice = await vscode.window.showInformationMessage(
      `PR Description Generated!\n\n${scoreMessage}\n${statusMessage}\n${description}`,
      ...actions
    );
    
    if (choice === 'Copy to Clipboard') {
      await vscode.env.clipboard.writeText(result.description);
      vscode.window.showInformationMessage('PR description copied to clipboard!');
    } else if (choice === 'View Details') {
      await showPRDescriptionPreview(result);
    } else if (choice === 'View Warnings') {
      await showValidationWarnings(result.validation.warnings);
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to generate PR description: ${message}`);
    console.error('PR generation error:', error);
  }
}

/**
 * Show PR description preview in a new document
 */
async function showPRDescriptionPreview(result: any) {
  const doc = await vscode.workspace.openTextDocument({
    content: result.description,
    language: 'markdown'
  });
  
  const editor = await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside
  });
  
  // Add metadata as comment at the top
  const metadata = [
    '<!-- PR Description Quality Report -->',
    `<!-- Score: ${result.estimatedScore}/100 -->`,
    `<!-- Grade: ${getScoreGrade(result.estimatedScore)} -->`,
    `<!-- Commits Analyzed: ${result.metadata.commitsAnalyzed} -->`,
    `<!-- Files Changed: ${result.metadata.filesChanged} -->`,
    `<!-- JIRA Aligned: ${result.metadata.jiraAligned ? 'Yes' : 'No'} -->`,
    `<!-- Language: ${result.metadata.language} -->`,
    `<!-- Coverage Detected: ${result.metadata.coverageDetected ? 'Yes' : 'No'} -->`,
    '<!-- -->',
    ''
  ].join('\n');
  
  await editor.edit(editBuilder => {
    editBuilder.insert(new vscode.Position(0, 0), metadata);
  });
}

/**
 * Show validation warnings in an output channel
 */
async function showValidationWarnings(warnings: string[]) {
  const outputChannel = vscode.window.createOutputChannel('PR Description Validation');
  outputChannel.clear();
  outputChannel.appendLine('PR Description Validation Warnings');
  outputChannel.appendLine('='.repeat(50));
  outputChannel.appendLine('');
  
  if (warnings.length === 0) {
    outputChannel.appendLine('✅ No warnings - PR description looks good!');
  } else {
    warnings.forEach((warning, index) => {
      outputChannel.appendLine(`${index + 1}. ${warning}`);
    });
    outputChannel.appendLine('');
    outputChannel.appendLine('Suggestions:');
    outputChannel.appendLine('- Add more detailed descriptions to sections');
    outputChannel.appendLine('- Include specific test instructions');
    outputChannel.appendLine('- Document potential impacts and risks');
    outputChannel.appendLine('- Link related JIRA issues if available');
  }
  
  outputChannel.show();
}
