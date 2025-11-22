
import * as vscode from 'vscode';
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';
import { fetchIssue } from './jiraClient';
import { analyzeStaged, DiffSummary } from './diffAnalyzer';
import { renderTemplate } from './template';
import { getConfig, ensureApiToken, inferScope, guessTypeFromDiff, detectBreaking, resetJiraApiToken, Config, pickRepository, getActiveRepository, escapeShellArg } from './utils';
import { JiraIssue } from './types';
import { getAiClient, callAI } from './ai';
import { AIConfig } from './ai/aiProvider';
import { resetApiKey, setApiKeyViaSettings } from './aiKeyManager';
import { generatePRDescriptionCommand } from './commands/generatePRDescription';
import { firstPromptGeneratorCommand } from './commands/firstPromptGenerator';

import { installPreCommitHookCommand } from './commands/hookGenerator';

const exec = promisify(cpExec);

let statusBar: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  // Store context globally for PR generator to access secrets
  (global as any).extensionContext = context;

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = 'JIRA: …';
  statusBar.command = 'jiraSmartCommit.generate';
  statusBar.tooltip = 'Generate commit message from JIRA + staged changes';
  statusBar.show();

  context.subscriptions.push(
    vscode.commands.registerCommand('jiraSmartCommit.generate', () => withHandledErrors(generateCommand(context))),
    vscode.commands.registerCommand('jiraSmartCommit.insert', () => withHandledErrors(insertCommand(context))),
    vscode.commands.registerCommand('jiraSmartCommit.commit', () => withHandledErrors(commitCommand(context))),
    vscode.commands.registerCommand('jiraSmartCommit.resetApiKey', () => withHandledErrors(resetApiKey(context))),
    vscode.commands.registerCommand('jiraSmartCommit.setApiKey', () => withHandledErrors(setApiKeyViaSettings())),
    vscode.commands.registerCommand('jiraSmartCommit.resetJiraApiToken', () => withHandledErrors(resetJiraApiToken(context))),
    vscode.commands.registerCommand('jiraSmartCommit.generatePRDescription', () => withHandledErrors(generatePRDescriptionCommand())),
    vscode.commands.registerCommand('jiraSmartCommit.firstPromptGenerator', () => withHandledErrors(firstPromptGeneratorCommand())),
    vscode.commands.registerCommand('jiraSmartCommit.installHook', () => withHandledErrors(installPreCommitHookCommand()))
  );

  // Listen for active text editor changes to update status bar for multi-root workspaces
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      withHandledErrors(updateStatusBar());
    })
  );

  // On activation, try to update status bar with detected key
  withHandledErrors(updateStatusBar());
}

export function deactivate() { }

async function withHandledErrors<T>(p: Promise<T>): Promise<T | void> {
  try {
    return await p;
  } catch (err: any) {
    vscode.window.showErrorMessage(`[Jira Smart Commit] ${err?.message ?? err}`);
  }
}

async function updateStatusBar() {
  const repoInfo = await getActiveRepository();
  if (!repoInfo) {
    statusBar.text = 'JIRA: (no repo)';
    return;
  }

  const key = await detectJiraKeyFromBranch(repoInfo.cwd);
  statusBar.text = key ? `JIRA: ${key} (${repoInfo.name})` : `JIRA: (no key) (${repoInfo.name})`;
}

async function detectJiraKeyFromBranch(cwd: string): Promise<string | undefined> {
  try {
    const cfg = getConfig();
    const { stdout } = await exec('git rev-parse --abbrev-ref HEAD', { cwd });
    const branch = stdout.trim();
    const regex = new RegExp(cfg.branchPattern);
    const match = regex.exec(branch);
    const key = match?.groups?.['key'] ?? match?.[1];
    return key;
  } catch (error) {
    // Handle case where repository has no commits yet or other git errors
    return undefined;
  }
}

async function pickOrDetectJiraKey(cwd: string): Promise<string | undefined> {
  const key = await detectJiraKeyFromBranch(cwd);
  if (key) return key;

  return vscode.window.showInputBox({
    title: 'Enter JIRA Issue Key (e.g., ABC-123)',
    validateInput: (v) => (/^[A-Z][A-Z0-9]+-\d+$/.test(v) ? undefined : 'Invalid JIRA key'),
  });
}

async function getGitMessageBox(targetCwd?: string): Promise<vscode.SourceControlInputBox | undefined> {
  const gitExt = vscode.extensions.getExtension('vscode.git');
  if (!gitExt) return;
  const api = gitExt.isActive ? gitExt.exports.getAPI(1) : (await gitExt.activate(), gitExt.exports.getAPI(1));

  // If targetCwd is provided, find the matching repository
  if (targetCwd) {
    const repo = api.repositories?.find((r: any) => r.rootUri.fsPath === targetCwd);
    return repo?.inputBox;
  }

  // Fallback to first repository (for backward compatibility)
  const repo = api.repositories?.[0];
  return repo?.inputBox;
}

/**
 * Appends the JIRA key to the commit message based on the configured position.
 * Prevents AI hallucination by hardcoding the Refs footer.
 */
function appendJiraKeyToMessage(message: string, issue: JiraIssue, cfg: Config): string {
  const lines = message.split('\n');
  const key = issue.key;

  // Build the related keys footer if needed (only when fetchRelatedIssues is enabled)
  const related = cfg.fetchRelatedIssues && cfg.relatedIssuesInFooter && issue.relatedKeys?.length
    ? `, ${issue.relatedKeys.slice(0, 6).join(', ')}`
    : '';

  switch (cfg.jiraKeyPosition) {
    case 'subject-prefix':
      // Add JIRA key as prefix to the first line: "JIRA-123 feat(scope): message"
      if (lines[0]) {
        lines[0] = `${key} ${lines[0]}`;
      }
      return lines.join('\n');

    case 'subject-suffix':
      // Add JIRA key as suffix to the first line: "feat(scope): message [JIRA-123]"
      if (lines[0]) {
        lines[0] = `${lines[0]} [${key}]`;
      }
      return lines.join('\n');

    case 'footer':
    default:
      // Add as footer: "Refs: JIRA-123" (hardcoded, not AI-generated)
      // Find where to insert the footer (after body, before or with other footers)
      const refsFooter = `Refs: ${key}${related}`;

      // Check if there's already a footer section (BREAKING CHANGE, etc.)
      const hasFooter = lines.some(line => /^[A-Z][a-z-]+:/.test(line.trim()));

      if (hasFooter) {
        // Insert Refs before other footers or at the end
        const footerIndex = lines.findIndex(line => /^[A-Z][a-z-]+:/.test(line.trim()));
        if (footerIndex !== -1) {
          lines.splice(footerIndex, 0, refsFooter);
        } else {
          lines.push('', refsFooter);
        }
      } else {
        // No footers yet, add with a blank line separator
        if (lines[lines.length - 1]?.trim()) {
          lines.push('');
        }
        lines.push(refsFooter);
      }

      return lines.join('\n');
  }
}

async function generate(context: vscode.ExtensionContext, progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<{ message: string; cwd: string }> {
  // Pick repository (auto-detect or let user choose)
  const repoInfo = await pickRepository();
  if (!repoInfo) throw new Error('No Git repository selected.');

  const { cwd } = repoInfo;

  // Reload config with repository context to support .jira-smart-commit.json
  const cfg = getConfig(cwd);

  const key = await pickOrDetectJiraKey(cwd);
  if (!key) throw new Error('No JIRA key provided.');

  await updateStatusBar();

  // Secrets: prompt & store token if missing
  const token = await ensureApiToken(context);

  // Try fetching JIRA; if fails, proceed with diff-only
  let issue: JiraIssue | undefined;
  try {
    progress?.report({ message: 'Fetching JIRA issue...', increment: 10 });
    issue = await fetchIssue({
      key,
      baseUrl: cfg.baseUrl,
      email: cfg.email,
      apiToken: token,
      fetchRelatedIssues: cfg.fetchRelatedIssues
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    vscode.window.showWarningMessage(`Could not reach JIRA for ${key}: ${errorMsg}. Generating from diffs only.`);
  }

  // Analyze staged changes
  progress?.report({ message: 'Analyzing staged changes...', increment: 20 });
  const diff: DiffSummary = await analyzeStaged(cwd);

  // Check if there are any staged changes
  if (diff.files.length === 0) {
    throw new Error('No staged changes found. Please stage your changes with "git add" before generating a commit message.');
  }

  // Guess type & scope
  const type = cfg.enableConventionalCommits ? guessTypeFromDiff(diff) : '';
  const scope = cfg.scopeStrategy !== 'none' ? await inferScope(cfg.scopeStrategy, diff) : '';
  const breaking = cfg.detectBreakingChanges ? detectBreaking(diff) : false;

  // 1) Default template (non-AI) as a baseline
  let baseline = renderTemplate({ cfg, diff, issue, meta: { type, scope, breaking } });

  // Apply JIRA key position to baseline
  if (issue?.key) {
    baseline = appendJiraKeyToMessage(baseline, issue, cfg);
  }

  // 2) Optionally run AI polishing/synthesis
  const aiEnabled = vscode.workspace.getConfiguration('jiraSmartCommit.ai').get<boolean>('enabled', false);
  if (!aiEnabled) return { message: baseline, cwd };

  progress?.report({ message: 'Preparing AI request...', increment: 10 });

  // Import AI config manager for team gateway support
  const { getAIConfigWithTeamDefaults } = await import('./aiConfigManager');
  const aiConfigWithDefaults = getAIConfigWithTeamDefaults(cwd);

  const aiCfg: AIConfig = {
    provider: aiConfigWithDefaults.provider,
    model: aiConfigWithDefaults.model,
    baseUrl: aiConfigWithDefaults.baseUrl,
    maxTokens: aiConfigWithDefaults.maxTokens,
    temperature: aiConfigWithDefaults.temperature,
    systemPrompt: aiConfigWithDefaults.systemPrompt
  };

  const format = aiConfigWithDefaults.format;
  const lang = aiConfigWithDefaults.language;
  const defaultSystem = `You are a senior software engineer writing precise, concise commit messages following the Conventional Commits 1.0.0 specification.

Conventional Commits structure:
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

REQUIRED format rules:
1. Type: MUST be one of: feat, fix, build, chore, ci, docs, style, refactor, perf, test
2. Scope: MAY be provided in parentheses after type, e.g., feat(parser):
3. Description: MUST immediately follow colon and space. Keep ≤72 chars. Use lowercase and imperative mood.
4. Body: MAY be provided after blank line. Wrap at ~72 chars. Provide context about WHAT changed and WHY.
5. Footer: MAY be provided after blank line. Use format: "Token: value" or "Token #value"
6. Breaking changes: MUST use "!" after type/scope OR "BREAKING CHANGE:" footer with description

Important:
- NEVER fabricate requirements or files. Only use provided facts.
- NO trailing spaces or extra blank lines at end
- Output ONLY the commit message—no commentary
- Language: ${lang}`;

  const system = aiCfg.systemPrompt?.trim() ? aiCfg.systemPrompt : defaultSystem;

  // Calculate token allocation based on strategy
  const reservedForResponse = 300;
  const systemTokens = estimateTokens(system);
  const totalAvailable = aiCfg.maxTokens - systemTokens - reservedForResponse;

  // Allocate tokens between description, acceptance criteria, and diff
  let descriptionTokens: number;
  let diffTokens: number;

  const acceptanceCriteriaText = (issue?.acceptance ?? []).map(b => '- ' + b).join('\n') || '- (not provided)';
  const acceptanceTokens = estimateTokens(acceptanceCriteriaText);
  const fixedContextTokens = estimateTokens(`Context:
- Branch: ${await currentBranch(cwd)}
- JIRA: ${issue?.key ?? '(no-key)'} — ${issue?.summary ?? '(no summary)'}
- Why (from JIRA): 

Detected:
- type: ${type}
- scope: ${scope}
- breaking: ${breaking}

Task:
Generate a ${format} commit message that:
1) Uses the detected type/scope if helpful.
2) Accurately summarizes what changed (from staged changes).
3) Mentions the 'why' succinctly.
4) Includes a Refs footer with ${issue?.key ?? '(no-key)'}${issue?.relatedKeys?.length ? ', ' + issue.relatedKeys.slice(0, 6).join(', ') : ''}.
5) If breaking === true, append a "BREAKING CHANGE:" footer with a one-line note.

Staged changes:
`) + acceptanceTokens;

  const availableForContent = Math.max(0, totalAvailable - fixedContextTokens);

  switch (cfg.tokenAllocationStrategy) {
    case 'prefer-description':
      descriptionTokens = Math.floor(availableForContent * 0.7);
      diffTokens = availableForContent - descriptionTokens;
      break;
    case 'prefer-diff':
      diffTokens = Math.floor(availableForContent * 0.7);
      descriptionTokens = availableForContent - diffTokens;
      break;
    case 'balanced':
    default:
      descriptionTokens = Math.floor(availableForContent * 0.4);
      diffTokens = availableForContent - descriptionTokens;
      break;
  }

  // Get description and diff with token budget
  const descriptionText = getJiraDescription(issue?.description ?? '', cfg, descriptionTokens);
  const stagedChangesText = getStagedChangesText(diff, diffTokens, 0); // Pass 0 since we already calculated available tokens

  // Get commit history for context if enabled
  let commitHistoryText = '';
  if (cfg.includeCommitHistory && key) {
    const previousCommits = await getPreviousCommitsForTicket(key, cwd, cfg.commitHistoryLimit);
    if (previousCommits.length > 0) {
      commitHistoryText = `\n- Previous commits for this ticket (${previousCommits.length}):\n${previousCommits.map(c => `  • ${c.hash}: ${c.subject} (${c.date})`).join('\n')}`;
    }
  }

  // Build base prompt with token-aware content
  const basePrompt = `Context:
- Branch: ${await currentBranch(cwd)}
- JIRA: ${issue?.key ?? '(no-key)'} — ${issue?.summary ?? '(no summary)'}
- Description: ${descriptionText}
- Acceptance criteria:
${acceptanceCriteriaText}${commitHistoryText}

Detected metadata:
- type: ${type}
- scope: ${scope}
- breaking: ${breaking}

Task:
Generate a Conventional Commits 1.0.0 compliant message that:
1) Uses format: ${type}${scope ? `(${scope})` : ''}${breaking ? '!' : ''}: <description>
2) Description: imperative mood, lowercase, ≤72 chars, summarizes WHAT changed
3) Body: blank line then explain WHY and provide context (wrap ~72 chars)
4) ${commitHistoryText ? 'Focus on what\'s NEW in this commit (avoid repeating previous commits)\n5) ' : ''}Do NOT include any footer with Refs, JIRA keys, or related issues (will be added automatically)
${commitHistoryText ? '6' : '5'}) If breaking === true, add footer after blank line: "BREAKING CHANGE: <description>"`;

  const defaultUser = `${basePrompt}

Staged changes:
${stagedChangesText}`;

  const userTemplate = aiConfigWithDefaults.userPromptTemplate;
  const user = userTemplate?.trim() ? applyUserTemplate(userTemplate, {
    format, lang, type, scope, breaking,
    issue, diff, stagedChangesText, descriptionText, acceptanceCriteriaText, commitHistoryText
  }) : defaultUser;

  try {
    progress?.report({ message: `Calling ${aiCfg.provider} AI (${aiCfg.model})...`, increment: 40 });
    const client = await getAiClient(context, aiCfg);
    let aiOut = await callAI(client, { system, user });
    aiOut = aiOut.trim();

    progress?.report({ message: 'Finalizing commit message...', increment: 20 });

    // Hardcode the Refs footer to prevent AI hallucination
    if (aiOut && issue?.key) {
      aiOut = appendJiraKeyToMessage(aiOut, issue, cfg);
    }

    return { message: aiOut || baseline, cwd };
  } catch (e: any) {
    // Check if error is due to missing/cancelled API key
    const isMissingKey = e?.message?.includes('API key') || e?.message?.includes('required');
    if (isMissingKey) {
      vscode.window.showWarningMessage(`AI key not provided. Using conventional commit format instead.`);
    } else {
      vscode.window.showWarningMessage(`AI post-processing failed: ${e?.message ?? e}. Falling back to baseline.`);
    }
    return { message: baseline, cwd };
  }
}

// Command: Generate + Preview
// Command: Generate + Preview
async function generateCommand(context: vscode.ExtensionContext) {
  const cfg = getConfig();

  const result = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Generating commit message...",
    cancellable: false
  }, async (progress) => {
    return await generate(context, progress);
  });

  if (cfg.commitDirectly) {
    await writeToGitBox(result.message, result.cwd);
    await doCommit(result.cwd);
    vscode.window.showInformationMessage('Committed with JIRA Smart Commit.');
    return;
  }

  const doc = await vscode.workspace.openTextDocument({ content: result.message, language: 'git-commit' });
  await vscode.window.showTextDocument(doc, { preview: true });
}

// Command: Generate + Insert
async function insertCommand(context: vscode.ExtensionContext) {
  const result = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Generating commit message...",
    cancellable: false
  }, async (progress) => {
    return await generate(context, progress);
  });
  await writeToGitBox(result.message, result.cwd);
  vscode.window.showInformationMessage('Commit message inserted.');
}

// Command: Generate + Commit (with preview)
async function commitCommand(context: vscode.ExtensionContext) {
  // Generate the commit message
  const result = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Generating commit message...",
    cancellable: false
  }, async (progress) => {
    return await generate(context, progress);
  });

  // Show modal dialog with message preview
  const action = await vscode.window.showInformationMessage(
    'Ready to commit with this message?',
    {
      modal: true,          // Makes it a blocking modal dialog
      detail: result.message       // Shows the full commit message
    },
    'Commit Now',           // Button 1
    'Edit in Git Input'     // Button 2 (user can close dialog to cancel)
  );

  // Handle user's choice
  switch (action) {
    case 'Commit Now':
      // Insert message and commit immediately using the selected repository
      await writeToGitBox(result.message, result.cwd);
      await doCommit(result.cwd);
      vscode.window.showInformationMessage('✓ Changes committed successfully!');
      break;

    case 'Edit in Git Input':
      // Insert message into Git input box for review
      await writeToGitBox(result.message, result.cwd);
      vscode.window.showInformationMessage('✓ Message inserted into Git input box. Review and commit when ready.');
      break;

    case undefined:  // User closed the dialog or clicked Cancel
      // Do nothing - operation cancelled
      vscode.window.showInformationMessage('Commit cancelled.');
      break;
  }
}

async function writeToGitBox(message: string, cwd?: string) {
  const box = await getGitMessageBox(cwd);
  if (!box) throw new Error('No Git repository/input found.');
  box.value = message;
}

async function doCommit(cwd: string) {
  const box = await getGitMessageBox(cwd);
  const msg = box?.value ?? '';
  if (!msg.trim()) throw new Error('Empty commit message.');
  await exec(`git commit -m ${escapeShellArg(msg)}`, { cwd });
}

async function currentBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await exec('git rev-parse --abbrev-ref HEAD', { cwd });
    return stdout.trim();
  } catch { return '(unknown)'; }
}

// Get previous commits for the same JIRA ticket
async function getPreviousCommitsForTicket(jiraKey: string, cwd: string, limit: number = 5): Promise<Array<{ hash: string, subject: string, date: string }>> {
  try {
    // Get commits that mention the JIRA key, excluding the current staged changes
    const { stdout } = await exec(
      `git log --all --grep=${escapeShellArg(jiraKey)} --format="%h|%s|%ar" -n ${limit}`,
      { cwd }
    );

    if (!stdout.trim()) return [];

    return stdout.trim().split('\n').map(line => {
      const [hash, subject, date] = line.split('|');
      return { hash, subject, date };
    }).filter(commit => commit.hash && commit.subject);
  } catch {
    return [];
  }
}

function toBulletsInline(diff: DiffSummary): string {
  if (!diff.files.length) return '- (no staged changes)';
  const items = diff.files.slice(0, 40).map(f => `${f.status} ${f.path}`);
  if (diff.hasMigrations) items.push('migrations detected');
  if (diff.deletedPublicApis.length) items.push(`deleted: ${diff.deletedPublicApis.slice(0, 10).join(', ')}`);
  return items.map(s => '- ' + s).join('\\n');
}

// Rough token estimation (1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Smart truncation at sentence or paragraph boundaries
function smartTruncate(text: string, maxChars: number, enabled: boolean): string {
  if (!text || text.length <= maxChars) return text;
  if (!enabled) return text.slice(0, maxChars);

  // Try to break at paragraph (double newline)
  const paragraphs = text.split(/\n\n+/);
  let result = '';
  for (const para of paragraphs) {
    if ((result + para).length > maxChars) break;
    result += (result ? '\n\n' : '') + para;
  }

  if (result && result.length >= maxChars * 0.7) return result; // At least 70% of target

  // Try to break at sentence
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  result = '';
  for (const sentence of sentences) {
    if ((result + sentence).length > maxChars) break;
    result += sentence;
  }

  if (result && result.length >= maxChars * 0.5) return result; // At least 50% of target

  // Fall back to character limit at word boundary
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > maxChars * 0.8 ? truncated.slice(0, lastSpace) : truncated;
}

// Get JIRA description with token budget awareness
function getJiraDescription(description: string, cfg: Config, availableTokens: number): string {
  if (!description) return '(no description)';

  // Calculate max chars from available tokens
  const maxCharsFromTokens = availableTokens * 4;

  // Apply user's max length constraint if set
  let maxChars = maxCharsFromTokens;
  if (cfg.descriptionMaxLength > 0) {
    maxChars = Math.min(maxChars, cfg.descriptionMaxLength);
  }

  // If description fits, return as-is
  if (description.length <= maxChars) {
    return description;
  }

  // Smart truncate
  const truncated = smartTruncate(description, maxChars, cfg.smartTruncation);
  return truncated + '\n...(description truncated)';
}

// Create staged changes summary with optional full diff based on token budget
function getStagedChangesText(diff: DiffSummary, availableTokens: number, _unused: number): string {
  const summary = toBulletsInline(diff);

  // If no full diff available, return summary
  if (!diff.fullDiff) {
    return summary;
  }

  // Estimate tokens for full diff
  const fullDiffTokens = estimateTokens(diff.fullDiff);

  // If full diff fits in budget, use it
  if (fullDiffTokens <= availableTokens) {
    return `Full diff:\n\`\`\`diff\n${diff.fullDiff}\n\`\`\``;
  }

  // Try to include truncated diff
  const maxDiffChars = availableTokens * 4;
  if (maxDiffChars > 500) { // Only include if we have at least 500 chars
    const truncatedDiff = diff.fullDiff.substring(0, maxDiffChars);
    return `Partial diff (truncated to fit token budget):\n\`\`\`diff\n${truncatedDiff}\n...\n(diff truncated)\n\`\`\`\n\nFile summary:\n${summary}`;
  }

  // Fall back to summary only
  return summary;
}

function applyUserTemplate(tpl: string, ctx: any): string {
  const issue = ctx.issue as JiraIssue | undefined;
  const diff = ctx.diff as DiffSummary;
  const map: Record<string, string> = {
    '\\$\\{format\\}': String(ctx.format),
    '\\$\\{lang\\}': String(ctx.lang),
    '\\$\\{type\\}': String(ctx.type ?? ''),
    '\\$\\{scope\\}': String(ctx.scope ?? ''),
    '\\$\\{breaking\\}': String(ctx.breaking ?? false),
    '\\$\\{jira\\.key\\}': issue?.key ?? '(no-key)',
    '\\$\\{jira\\.summary\\}': issue?.summary ?? '(no summary)',
    '\\$\\{jira\\.oneLineDescription\\}': ((issue?.description ?? '').split(/\\r?\\n/)[0] ?? ''),
    '\\$\\{jira\\.description\\}': ctx.descriptionText || issue?.description || '(no description)',
    '\\$\\{jira\\.acceptanceBullets\\}': ctx.acceptanceCriteriaText || ((issue?.acceptance ?? []).map(b => '- ' + b).join('\\n') || '- (not provided)'),
    '\\$\\{jira\\.relatedKeysFooter\\}': issue?.relatedKeys?.length ? ', ' + issue.relatedKeys.slice(0, 6).join(', ') : '',
    '\\$\\{commitHistory\\}': ctx.commitHistoryText || '',
    '\\$\\{changes\\.bullets\\}': (() => {
      if (!diff.files.length) return '- (no staged changes)';
      const items = diff.files.slice(0, 40).map((f: any) => `${f.status} ${f.path}`);
      if (diff.hasMigrations) items.push('migrations detected');
      if (diff.deletedPublicApis.length) items.push(`deleted: ${diff.deletedPublicApis.slice(0, 10).join(', ')}`);
      return items.map(s => '- ' + s).join('\\n');
    })(),
    '\\$\\{stagedChanges\\}': ctx.stagedChangesText || toBulletsInline(diff)
  };

  let out = tpl;
  for (const [k, v] of Object.entries(map)) {
    out = out.replace(new RegExp(k, 'g'), v);
  }
  return out;
}
