import * as vscode from 'vscode';
import { getConfig, ensureApiToken, pickRepository, getActiveRepository } from '../utils';
import {
  getFirstPromptConfigWithTeamDefaults,
  getPRConfigWithTeamDefaults,
  getSecurityConfigWithTeamDefaults,
  getTestCoverageConfigWithTeamDefaults,
} from '../aiConfigManager';
import { DispatchMode, PromptRecipe } from '../board/types';
import { BoardCard } from '../board/schema';
import { upsertCard } from '../board/store';
import {
  buildPRRuntimeContext,
  selectFirstPromptTemplateType,
  tryFetchJiraIssueFromBranch,
} from '../orchestrator/contextBuilders';
import { executePromptRecipe } from '../orchestrator/recipeExecutor';
import { getPromptRunQueue } from '../orchestrator/queue';
import { markSecurityCompleted, markTestCoverageCompleted } from '../pr/prPrerequisites';

type RecipeSelection = 'firstPrompt.auto' | 'security.review' | 'testCoverage.enforce' | 'pr.description';
type ExtendedRecipeSelection = RecipeSelection | 'pr.createBitbucket';

export interface RunPromptRecipeOptions {
  recipe?: RecipeSelection | PromptRecipe;
  cwd?: string;
  dispatchMode?: DispatchMode;
  dryRun?: boolean;
  enqueue?: boolean;
  cardId?: string;
  cardTitle?: string;
}

function getDispatchMode(autoSubmit: boolean): DispatchMode {
  return autoSubmit ? 'autoSubmit' : 'pasteOnly';
}

async function resolveRepo(options?: RunPromptRecipeOptions) {
  if (options?.cwd) {
    const active = await getActiveRepository();
    if (active && active.cwd === options.cwd) {
      return active;
    }
  }
  return pickRepository();
}

async function pickRecipe(): Promise<ExtendedRecipeSelection | undefined> {
  const selected = await vscode.window.showQuickPick(
    [
      { label: 'First Prompt (auto task/bug)', value: 'firstPrompt.auto' as RecipeSelection },
      { label: 'Security Review', value: 'security.review' as RecipeSelection },
      { label: 'Test Coverage Enforcement', value: 'testCoverage.enforce' as RecipeSelection },
      { label: 'PR Description', value: 'pr.description' as RecipeSelection },
      { label: 'Create Bitbucket PR (from temp file)', value: 'pr.createBitbucket' as ExtendedRecipeSelection },
    ],
    {
      title: 'Run Prompt Recipe',
      placeHolder: 'Select recipe to generate and dispatch',
    }
  );

  return selected?.value;
}

function openPromptPreview(prompt: string): Thenable<vscode.TextEditor> {
  return vscode.workspace
    .openTextDocument({
      content: prompt,
      language: 'markdown',
    })
    .then((doc) => vscode.window.showTextDocument(doc, { preview: true }));
}

export async function runPromptRecipeCommand(options?: RunPromptRecipeOptions): Promise<void> {
  const repoInfo = await resolveRepo(options);
  if (!repoInfo) {
    return;
  }

  const recipeSelection = (options?.recipe as ExtendedRecipeSelection | undefined) || (await pickRecipe());
  if (!recipeSelection) {
    return;
  }

  if (!options || (options.dryRun === undefined && options.enqueue === undefined)) {
    const action = await vscode.window.showQuickPick(
      [
        { label: 'Enqueue and run', value: 'run' },
        { label: 'Preview prompt only (dry-run)', value: 'preview' },
      ],
      { title: 'Dispatch Mode' }
    );
    if (!action) {
      return;
    }
    if (action.value === 'preview') {
      options = { ...(options || {}), dryRun: true, enqueue: false };
    }
  }

  const branchName = repoInfo.repo.state.HEAD?.name;
  if (!branchName) {
    throw new Error('Could not determine current branch.');
  }

  let recipe: PromptRecipe;
  let dispatchMode: DispatchMode;
  let cwd = repoInfo.cwd;
  let buildInput: Parameters<typeof executePromptRecipe>[0]['buildInput'] = { cwd };
  let cardTitle = options?.cardTitle;
  let jiraKey: string | undefined;

  switch (recipeSelection) {
    case 'firstPrompt.auto': {
      const cfg = getConfig(repoInfo.cwd);
      if (!cfg.baseUrl || !cfg.email) {
        throw new Error('JIRA configuration incomplete. Please configure baseUrl and email in settings.');
      }

      const context = (global as any).extensionContext as vscode.ExtensionContext;
      await ensureApiToken(context);

      const fetched = await tryFetchJiraIssueFromBranch(branchName, cfg.fetchRelatedIssues);
      if (!fetched.jiraIssue) {
        throw new Error(`Could not fetch JIRA issue from branch '${branchName}'.`);
      }

      const templateType = selectFirstPromptTemplateType(fetched.jiraIssue.issueType || 'Task');
      recipe = templateType === 'bug' ? 'firstPrompt.bug' : 'firstPrompt.task';
      dispatchMode = getDispatchMode(getFirstPromptConfigWithTeamDefaults(repoInfo.cwd).autoSubmit);
      buildInput = { cwd, issue: fetched.jiraIssue };
      cardTitle = cardTitle || `${fetched.jiraIssue.key}: ${fetched.jiraIssue.summary}`;
      jiraKey = fetched.jiraIssue.key;
      break;
    }
    case 'security.review': {
      recipe = 'security.review';
      dispatchMode = getDispatchMode(getSecurityConfigWithTeamDefaults(repoInfo.cwd).autoSubmit);
      buildInput = { cwd };
      cardTitle = cardTitle || `Security Review (${branchName})`;
      break;
    }
    case 'testCoverage.enforce': {
      recipe = 'testCoverage.enforce';
      dispatchMode = getDispatchMode(getTestCoverageConfigWithTeamDefaults(repoInfo.cwd).autoSubmit);
      buildInput = { cwd };
      cardTitle = cardTitle || `Test Coverage (${branchName})`;
      break;
    }
    case 'pr.description': {
      const maxCommits = vscode.workspace.getConfiguration('jiraSmartCommit.pr').get('maxCommits', 50) as number;
      const runtime = await buildPRRuntimeContext(maxCommits);

      if (runtime.context.commits.length === 0) {
        throw new Error(
          `No commits found on the current branch '${runtime.context.currentBranch}'.\n\n` +
            'Make sure you have commits on your branch to generate a PR description.'
        );
      }

      recipe = 'pr.description';
      cwd = runtime.workspaceRoot;
      dispatchMode = getDispatchMode(getPRConfigWithTeamDefaults(cwd).autoSubmit);
      buildInput = { cwd, prContext: runtime.context };
      cardTitle = cardTitle || `PR Description (${runtime.context.currentBranch})`;
      jiraKey = runtime.jiraKey;
      break;
    }
    case 'pr.createBitbucket': {
      recipe = 'pr.createBitbucket';
      dispatchMode = 'pasteOnly';
      buildInput = { cwd };
      cardTitle = cardTitle || `Create Bitbucket PR (${branchName})`;
      break;
    }
    default:
      recipe = recipeSelection as PromptRecipe;
      dispatchMode = getDispatchMode(false);
      break;
  }

  if (options?.dispatchMode) {
    dispatchMode = options.dispatchMode;
  }

  if (recipe !== 'pr.createBitbucket') {
    const execution = await executePromptRecipe({
      recipe,
      cwd,
      buildInput,
      dispatchMode,
      dispatchToCopilotChat: false,
    });

    if (execution.lintWarnings.length) {
      vscode.window.showWarningMessage(
        `Template warnings for '${recipe}': ${execution.lintWarnings.map((w) => `{{${w}}}`).join(', ')}`
      );
    }

    if (options?.dryRun) {
      await openPromptPreview(execution.prompt);
      vscode.window.showInformationMessage(`Preview generated for '${recipe}'.`);
      return;
    }

    if (options?.enqueue === false) {
      await openPromptPreview(execution.prompt);
      vscode.window.showInformationMessage(`Run prepared for '${recipe}' (not enqueued).`);
      return;
    }
  } else if (options?.dryRun || options?.enqueue === false) {
    vscode.window.showInformationMessage(
      "Bitbucket PR creation recipe doesn't support preview mode. Use 'Enqueue and run'."
    );
    return;
  }

  const cardId = options?.cardId || `${recipe}:${jiraKey || branchName}`;
  const card: BoardCard = {
    id: cardId,
    title: cardTitle || recipe,
    recipe,
    agent: 'copilot',
    jiraKey,
    column: 'Backlog',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const board = upsertCard(cwd, card);

  const existingActiveRun = board.runs.find(
    (r) => r.cardId === card.id && (r.status === 'pending' || r.status === 'running')
  );
  if (existingActiveRun) {
    vscode.window.showWarningMessage(`Card '${card.title}' already has an active run (${existingActiveRun.status}).`);
    return;
  }

  const queue = getPromptRunQueue();
  const runId = queue.enqueue({
    cwd,
    card,
    recipe,
    dispatchMode,
    buildInput,
    timeoutMs: 120000,
    maxRetries: 1,
  });

  if (recipe === 'security.review') {
    await markSecurityCompleted(branchName);
  }

  if (recipe === 'testCoverage.enforce') {
    await markTestCoverageCompleted(branchName);
  }

  vscode.window.showInformationMessage(`✓ Enqueued '${recipe}' (run: ${runId}).`);
}
