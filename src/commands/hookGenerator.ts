import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { VALIDATION_SCRIPT } from '../templates/hookTemplate';
import { getActiveRepository } from '../utils';

export async function installPreCommitHookCommand() {
    const repo = await getActiveRepository();
    if (!repo) {
        vscode.window.showErrorMessage('No Git repository found. Please open a file within a Git repository.');
        return;
    }

    const gitDir = path.join(repo.cwd, '.git');
    const hooksDir = path.join(gitDir, 'hooks');
    const hookFile = path.join(hooksDir, 'commit-msg');
    const scriptDir = path.join(repo.cwd, '.git', 'hooks', 'scripts'); // Store script in .git/hooks/scripts to keep root clean? 
    // Actually, let's put it in a visible place if we want users to customize it, or hidden if we want it managed.
    // The plan said "scripts/validate-commit-msg.js (or similar hidden location)".
    // Let's put it in .husky/ or .githooks/ if those exist, otherwise maybe just embed it in the hook or put it in .git/hooks/jira-smart-commit-validate.js

    // Simpler approach: Write the node script directly to .git/hooks/commit-msg if possible, but commit-msg is usually a shell script.
    // Better: Write the JS file to .git/hooks/validate-commit-msg.js and call it from .git/hooks/commit-msg

    const validatorScriptPath = path.join(hooksDir, 'validate-commit-msg.js');

    try {
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }

        // 1. Write the validation script
        fs.writeFileSync(validatorScriptPath, VALIDATION_SCRIPT);
        fs.chmodSync(validatorScriptPath, '755');

        // 2. Create or update commit-msg hook
        let hookContent = '#!/bin/sh\n';
        if (fs.existsSync(hookFile)) {
            hookContent = fs.readFileSync(hookFile, 'utf8');
        }

        const callCommand = `node "${validatorScriptPath}" "$1"`;

        if (!hookContent.includes('validate-commit-msg.js')) {
            // Append execution
            hookContent += `\n# JIRA Smart Commit Validation\n${callCommand}\n`;
            fs.writeFileSync(hookFile, hookContent);
            fs.chmodSync(hookFile, '755');
            vscode.window.showInformationMessage('Pre-commit hook installed successfully!');
        } else {
            vscode.window.showInformationMessage('Pre-commit hook is already installed.');
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to install hook: ${error.message}`);
    }
}
