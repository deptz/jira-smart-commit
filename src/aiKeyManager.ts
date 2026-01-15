
import * as vscode from 'vscode';

const SECRET_KEY = 'jiraSmartCommit.ai.apiKey';

export async function getApiKey(context: vscode.ExtensionContext, providerName: string): Promise<string> {
  const stored = await context.secrets.get(SECRET_KEY);
  if (stored) return stored;

  const entered = await vscode.window.showInputBox({
    title: `Enter ${providerName} API Key`,
    password: true,
    ignoreFocusOut: true,
    prompt: `API key required for AI-powered commits. Cancel to use conventional commit format instead.`
  });
  if (!entered) throw new Error('API key is required. Falling back to non-AI commit generation.');
  await context.secrets.store(SECRET_KEY, entered);
  vscode.window.showInformationMessage('AI API key saved securely.');
  return entered;
}

export async function resetApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
  vscode.window.showInformationMessage('AI API key has been cleared from secure storage.');
}

export async function setApiKeyViaSettings(): Promise<void> {
  const key = await vscode.window.showInputBox({
    title: 'Enter AI API Key (will be stored securely)',
    password: true,
    ignoreFocusOut: true
  });
  if (!key) return;
  const context = (global as any).extensionContext as vscode.ExtensionContext | undefined;
  if (!context) {
    vscode.window.showWarningMessage('Unable to access secret storage from here; run a Generate command first.');
    return;
  }
  await context.secrets.store(SECRET_KEY, key);
  vscode.window.showInformationMessage('AI API key saved securely.');
}
