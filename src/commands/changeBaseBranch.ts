import * as vscode from 'vscode';
import { setBaseBranchForSession } from '../pr/gitOperations';

/**
 * Command handler to change base branch for the current PR generation session
 */
export async function changeBaseBranchCommand(): Promise<void> {
  const selected = await setBaseBranchForSession();
  vscode.window.showInformationMessage(`Base branch set to: ${selected}`);
}
