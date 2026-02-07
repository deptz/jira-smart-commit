import * as crypto from 'crypto';
import { BoardCard, RunRecord } from '../board/schema';
import { appendRun, updateCard, updateRun } from '../board/store';
import { DispatchMode, PromptRecipe } from '../board/types';
import { PromptRecipeBuildInput } from './promptRecipes';

type RecipeExecutor = (input: {
  recipe: PromptRecipe;
  cwd: string;
  buildInput?: PromptRecipeBuildInput;
  dispatchMode: DispatchMode;
  dispatchToCopilotChat: boolean;
}) => Promise<{ prompt: string; dispatchMode: DispatchMode }>;

type BitbucketPRCreator = (input: { cwd: string }) => Promise<{
  id: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
}>;

export interface QueueJob {
  cwd: string;
  card: BoardCard;
  runId?: string;
  recipe: PromptRecipe;
  dispatchMode: DispatchMode;
  buildInput?: PromptRecipeBuildInput;
  timeoutMs: number;
  maxRetries: number;
}

export class PromptRunQueue {
  constructor(
    private readonly executor: RecipeExecutor = defaultRecipeExecutor,
    private readonly bitbucketPRCreator: BitbucketPRCreator = defaultBitbucketPRCreator
  ) {}

  private queue: QueueJob[] = [];
  private active = false;

  enqueue(job: QueueJob): string {
    const runId = crypto.randomUUID();

    const runRecord: RunRecord = {
      id: runId,
      cardId: job.card.id,
      recipe: job.recipe,
      status: 'pending',
      dispatchMode: job.dispatchMode,
      startedAt: new Date().toISOString(),
      attempts: 0,
      promptHash: '',
    };

    appendRun(job.cwd, runRecord);
    updateCard(job.cwd, job.card.id, { column: 'Ready', lastRunId: runId });

    this.queue.push({ ...job, runId });
    this.process().catch(() => {
      // queue error is persisted in run records
    });

    return runId;
  }

  private async process(): Promise<void> {
    if (this.active) {
      return;
    }

    this.active = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        await this.runJob(job);
      }
    } finally {
      this.active = false;
    }
  }

  private async runJob(job: QueueJob): Promise<void> {
    const runState = job.runId;
    if (!runState) {
      return;
    }

    updateRun(job.cwd, runState, {
      status: 'running',
      attempts: 1,
      startedAt: new Date().toISOString(),
    });
    updateCard(job.cwd, job.card.id, { column: 'Doing' });

    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= job.maxRetries) {
      attempt += 1;
      try {
        if (job.recipe === 'pr.createBitbucket') {
          const created = await this.bitbucketPRCreator({ cwd: job.cwd });
          const promptHash = crypto.createHash('sha256').update(created.url).digest('hex');
          updateRun(job.cwd, runState, {
            status: 'succeeded',
            attempts: attempt,
            endedAt: new Date().toISOString(),
            outputSummary: `Created Bitbucket PR: ${created.url}`,
            promptHash,
          });
          updateCard(job.cwd, job.card.id, {
            column: 'Done',
            prId: created.id,
            prUrl: created.url,
            sourceBranch: created.sourceBranch,
            targetBranch: created.targetBranch,
          });
          return;
        }

        const execution = await Promise.race([
          this.executor({
            recipe: job.recipe,
            cwd: job.cwd,
            buildInput: job.buildInput,
            dispatchMode: job.dispatchMode,
            dispatchToCopilotChat: true,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Execution timed out after ${job.timeoutMs}ms`)), job.timeoutMs)
          ),
        ]);

        const promptHash = crypto.createHash('sha256').update(execution.prompt).digest('hex');
        updateRun(job.cwd, runState, {
          status: 'succeeded',
          attempts: attempt,
          endedAt: new Date().toISOString(),
          outputSummary: `Prompt ${execution.dispatchMode} to Copilot Chat`,
          promptHash,
        });
        updateCard(job.cwd, job.card.id, { column: 'Review' });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        updateRun(job.cwd, runState, {
          attempts: attempt,
          error: lastError,
        });
      }
    }

    updateRun(job.cwd, runState, {
      status: 'failed',
      endedAt: new Date().toISOString(),
      error: lastError,
    });
    updateCard(job.cwd, job.card.id, { column: 'Ready' });
  }
}

let singletonQueue: PromptRunQueue | undefined;

export function getPromptRunQueue(): PromptRunQueue {
  if (!singletonQueue) {
    singletonQueue = new PromptRunQueue();
  }
  return singletonQueue;
}

async function defaultRecipeExecutor(input: {
  recipe: PromptRecipe;
  cwd: string;
  buildInput?: PromptRecipeBuildInput;
  dispatchMode: DispatchMode;
  dispatchToCopilotChat: boolean;
}): Promise<{ prompt: string; dispatchMode: DispatchMode }> {
  const { executePromptRecipe } = await import('./recipeExecutor');
  return executePromptRecipe(input);
}

async function defaultBitbucketPRCreator(input: { cwd: string }): Promise<{
  id: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
}> {
  const { createBitbucketPRFromTempFile } = await import('../pr/bitbucketPR');
  return createBitbucketPRFromTempFile({ cwd: input.cwd });
}
