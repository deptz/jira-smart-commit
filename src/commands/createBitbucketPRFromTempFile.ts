import * as vscode from 'vscode';
import { createBitbucketPRFromTempFile } from '../pr/bitbucketPR';

export async function createBitbucketPRFromTempFileCommand(options?: {
  cwd?: string;
  autoOpen?: boolean;
}): Promise<void> {
  const created = await createBitbucketPRFromTempFile({
    cwd: options?.cwd,
    autoOpen: options?.autoOpen,
  });

  vscode.window.showInformationMessage(
    `✓ Bitbucket PR created: ${created.title} (${created.sourceBranch} -> ${created.targetBranch})`,
    'Open PR'
  ).then(async (action) => {
    if (action === 'Open PR') {
      await vscode.env.openExternal(vscode.Uri.parse(created.url));
    }
  });
}
