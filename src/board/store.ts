import * as fs from 'fs';
import * as path from 'path';
import {
  BOARD_SCHEMA_VERSION,
  DEFAULT_BOARD_FILE_NAME,
  KanbanBoardState,
  createEmptyBoard,
  BoardCard,
  RunRecord,
} from './schema';

function nowIso(): string {
  return new Date().toISOString();
}

function migrateBoard(input: any, repository: string): KanbanBoardState {
  if (!input || typeof input !== 'object') {
    return createEmptyBoard(repository);
  }

  const base = createEmptyBoard(repository);
  const migrated: KanbanBoardState = {
    ...base,
    ...input,
    version: BOARD_SCHEMA_VERSION,
    repository: input.repository || repository,
    columns: Array.isArray(input.columns) && input.columns.length ? input.columns : base.columns,
    cards: Array.isArray(input.cards) ? input.cards : [],
    runs: Array.isArray(input.runs) ? input.runs : [],
  };

  migrated.cards = migrated.cards.map((card: any): BoardCard => ({
    id: String(card.id),
    title: String(card.title || card.id),
    recipe: String(card.recipe || 'testCoverage.enforce'),
    agent: String(card.agent || 'copilot'),
    jiraKey: card.jiraKey ? String(card.jiraKey) : undefined,
    prUrl: card.prUrl ? String(card.prUrl) : undefined,
    prId: card.prId ? String(card.prId) : undefined,
    sourceBranch: card.sourceBranch ? String(card.sourceBranch) : undefined,
    targetBranch: card.targetBranch ? String(card.targetBranch) : undefined,
    column: card.column || 'Backlog',
    createdAt: card.createdAt || nowIso(),
    updatedAt: card.updatedAt || nowIso(),
    lastRunId: card.lastRunId ? String(card.lastRunId) : undefined,
  }));

  migrated.runs = migrated.runs.map((run: any): RunRecord => ({
    id: String(run.id),
    cardId: String(run.cardId),
    recipe: String(run.recipe),
    status: run.status || 'pending',
    dispatchMode: run.dispatchMode || 'pasteOnly',
    startedAt: run.startedAt || nowIso(),
    endedAt: run.endedAt,
    attempts: Number(run.attempts ?? 1),
    error: run.error,
    outputSummary: run.outputSummary,
    promptHash: String(run.promptHash || ''),
  }));

  migrated.updatedAt = nowIso();
  return migrated;
}

export function resolveBoardFile(cwd: string, fileName = DEFAULT_BOARD_FILE_NAME): string {
  return path.join(cwd, fileName);
}

export function loadBoard(cwd: string, fileName = DEFAULT_BOARD_FILE_NAME): KanbanBoardState {
  const repository = path.basename(cwd) || 'repo';
  const filePath = resolveBoardFile(cwd, fileName);

  if (!fs.existsSync(filePath)) {
    return createEmptyBoard(repository);
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return migrateBoard(parsed, repository);
  } catch {
    const backupPath = `${filePath}.broken.${Date.now()}`;
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch {
      // ignore backup failures
    }
    return createEmptyBoard(repository);
  }
}

export function saveBoard(cwd: string, board: KanbanBoardState, fileName = DEFAULT_BOARD_FILE_NAME): void {
  const filePath = resolveBoardFile(cwd, fileName);
  board.updatedAt = nowIso();

  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(board, null, 2));
  fs.renameSync(tempPath, filePath);
}

export function upsertCard(cwd: string, card: BoardCard, fileName = DEFAULT_BOARD_FILE_NAME): KanbanBoardState {
  const board = loadBoard(cwd, fileName);
  const existingIndex = board.cards.findIndex((c) => c.id === card.id);

  if (existingIndex >= 0) {
    board.cards[existingIndex] = {
      ...board.cards[existingIndex],
      ...card,
      updatedAt: nowIso(),
    };
  } else {
    board.cards.push(card);
  }

  saveBoard(cwd, board, fileName);
  return board;
}

export function appendRun(cwd: string, run: RunRecord, fileName = DEFAULT_BOARD_FILE_NAME): KanbanBoardState {
  const board = loadBoard(cwd, fileName);
  board.runs.push(run);
  saveBoard(cwd, board, fileName);
  return board;
}

export function updateRun(cwd: string, runId: string, patch: Partial<RunRecord>, fileName = DEFAULT_BOARD_FILE_NAME): KanbanBoardState {
  const board = loadBoard(cwd, fileName);
  const idx = board.runs.findIndex((r) => r.id === runId);
  if (idx >= 0) {
    board.runs[idx] = { ...board.runs[idx], ...patch };
  }
  saveBoard(cwd, board, fileName);
  return board;
}

export function updateCard(cwd: string, cardId: string, patch: Partial<BoardCard>, fileName = DEFAULT_BOARD_FILE_NAME): KanbanBoardState {
  const board = loadBoard(cwd, fileName);
  const idx = board.cards.findIndex((c) => c.id === cardId);
  if (idx >= 0) {
    board.cards[idx] = {
      ...board.cards[idx],
      ...patch,
      updatedAt: nowIso(),
    };
  }
  saveBoard(cwd, board, fileName);
  return board;
}

export function deleteCard(cwd: string, cardId: string, fileName = DEFAULT_BOARD_FILE_NAME): KanbanBoardState {
  const board = loadBoard(cwd, fileName);
  board.cards = board.cards.filter((c) => c.id !== cardId);
  saveBoard(cwd, board, fileName);
  return board;
}
