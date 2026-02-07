const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadBoard, upsertCard, appendRun, updateRun, updateCard } = require('../out/board/store');

function mkrepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-board-'));
}

test('loadBoard creates empty board when no file exists', () => {
  const cwd = mkrepo();
  const board = loadBoard(cwd);
  assert.equal(board.version, 2);
  assert.equal(board.cards.length, 0);
  assert.equal(board.runs.length, 0);
});

test('upsert and run updates are persisted', () => {
  const cwd = mkrepo();
  upsertCard(cwd, {
    id: 'card-1',
    title: 'Card',
    recipe: 'testCoverage.enforce',
    agent: 'copilot',
    column: 'Backlog',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  appendRun(cwd, {
    id: 'run-1',
    cardId: 'card-1',
    recipe: 'testCoverage.enforce',
    status: 'pending',
    dispatchMode: 'pasteOnly',
    startedAt: new Date().toISOString(),
    attempts: 0,
    promptHash: '',
  });

  updateRun(cwd, 'run-1', { status: 'succeeded', attempts: 1, endedAt: new Date().toISOString() });
  updateCard(cwd, 'card-1', { column: 'Review', lastRunId: 'run-1' });

  const board = loadBoard(cwd);
  assert.equal(board.cards[0].column, 'Review');
  assert.equal(board.runs[0].status, 'succeeded');
});

test('loadBoard migrates legacy cards without PR metadata', () => {
  const cwd = mkrepo();
  const legacy = {
    version: 1,
    repository: 'repo',
    updatedAt: new Date().toISOString(),
    columns: ['Backlog', 'Ready', 'Doing', 'Review', 'Done'],
    cards: [
      {
        id: 'legacy-1',
        title: 'Legacy card',
        recipe: 'pr.description',
        agent: 'copilot',
        column: 'Backlog',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    runs: [],
  };
  fs.writeFileSync(path.join(cwd, '.jira-smart-kanban.json'), JSON.stringify(legacy, null, 2));

  const board = loadBoard(cwd);
  assert.equal(board.version, 2);
  assert.equal(board.cards[0].prUrl, undefined);
  assert.equal(board.cards[0].prId, undefined);
});
