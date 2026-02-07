const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PromptRunQueue } = require('../out/orchestrator/queue');
const { upsertCard, loadBoard } = require('../out/board/store');

function mkrepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-queue-'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('queue processes job and writes run/card state', async () => {
  const cwd = mkrepo();
  const card = {
    id: 'card-1',
    title: 'Queue test',
    recipe: 'testCoverage.enforce',
    agent: 'copilot',
    column: 'Backlog',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  upsertCard(cwd, card);

  const queue = new PromptRunQueue(async () => ({
    recipe: 'testCoverage.enforce',
    prompt: 'hello',
    dispatchMode: 'pasteOnly',
    lintWarnings: [],
  }));

  queue.enqueue({
    cwd,
    card,
    recipe: 'testCoverage.enforce',
    dispatchMode: 'pasteOnly',
    timeoutMs: 1000,
    maxRetries: 0,
  });

  for (let i = 0; i < 20; i += 1) {
    const board = loadBoard(cwd);
    const run = board.runs[0];
    if (run && run.status === 'succeeded') {
      assert.equal(board.cards[0].column, 'Review');
      return;
    }
    await sleep(30);
  }

  const board = loadBoard(cwd);
  assert.equal(board.runs[0]?.status, 'succeeded');
});

test('queue marks Bitbucket PR card as done on success', async () => {
  const cwd = mkrepo();
  const card = {
    id: 'card-pr-1',
    title: 'Create PR',
    recipe: 'pr.createBitbucket',
    agent: 'copilot',
    column: 'Backlog',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  upsertCard(cwd, card);

  const queue = new PromptRunQueue(
    async () => ({ prompt: 'unused', dispatchMode: 'pasteOnly' }),
    async () => ({
      id: '99',
      url: 'https://bitbucket.org/workspace/repo/pull-requests/99',
      sourceBranch: 'feature/ABC-1',
      targetBranch: 'main',
      title: 'ABC-1 Implement flow',
    })
  );

  queue.enqueue({
    cwd,
    card,
    recipe: 'pr.createBitbucket',
    dispatchMode: 'pasteOnly',
    timeoutMs: 1000,
    maxRetries: 0,
  });

  for (let i = 0; i < 20; i += 1) {
    const board = loadBoard(cwd);
    const run = board.runs[0];
    if (run && run.status === 'succeeded') {
      assert.equal(board.cards[0].column, 'Done');
      assert.equal(board.cards[0].prUrl, 'https://bitbucket.org/workspace/repo/pull-requests/99');
      return;
    }
    await sleep(30);
  }

  const board = loadBoard(cwd);
  assert.equal(board.runs[0]?.status, 'succeeded');
  assert.equal(board.cards[0].column, 'Done');
});

test('queue restores Bitbucket PR card to ready on failure', async () => {
  const cwd = mkrepo();
  const card = {
    id: 'card-pr-2',
    title: 'Create PR fail',
    recipe: 'pr.createBitbucket',
    agent: 'copilot',
    column: 'Backlog',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  upsertCard(cwd, card);

  const queue = new PromptRunQueue(
    async () => ({ prompt: 'unused', dispatchMode: 'pasteOnly' }),
    async () => {
      throw new Error('Bitbucket API failed');
    }
  );

  queue.enqueue({
    cwd,
    card,
    recipe: 'pr.createBitbucket',
    dispatchMode: 'pasteOnly',
    timeoutMs: 1000,
    maxRetries: 0,
  });

  for (let i = 0; i < 20; i += 1) {
    const board = loadBoard(cwd);
    const run = board.runs[0];
    if (run && run.status === 'failed') {
      assert.equal(board.cards[0].column, 'Ready');
      return;
    }
    await sleep(30);
  }

  const board = loadBoard(cwd);
  assert.equal(board.runs[0]?.status, 'failed');
  assert.equal(board.cards[0].column, 'Ready');
});
