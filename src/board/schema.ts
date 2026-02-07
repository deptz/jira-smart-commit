export const BOARD_SCHEMA_VERSION = 2;
export const DEFAULT_BOARD_FILE_NAME = '.jira-smart-kanban.json';

export type BoardColumn = 'Backlog' | 'Ready' | 'Doing' | 'Review' | 'Done';
export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RunRecord {
  id: string;
  cardId: string;
  recipe: string;
  status: RunStatus;
  dispatchMode: 'autoSubmit' | 'pasteOnly';
  startedAt: string;
  endedAt?: string;
  attempts: number;
  error?: string;
  outputSummary?: string;
  promptHash: string;
}

export interface BoardCard {
  id: string;
  title: string;
  recipe: string;
  agent: string;
  jiraKey?: string;
  prUrl?: string;
  prId?: string;
  sourceBranch?: string;
  targetBranch?: string;
  column: BoardColumn;
  createdAt: string;
  updatedAt: string;
  lastRunId?: string;
}

export interface KanbanBoardState {
  version: number;
  repository: string;
  updatedAt: string;
  columns: BoardColumn[];
  cards: BoardCard[];
  runs: RunRecord[];
}

export function createEmptyBoard(repository: string): KanbanBoardState {
  return {
    version: BOARD_SCHEMA_VERSION,
    repository,
    updatedAt: new Date().toISOString(),
    columns: ['Backlog', 'Ready', 'Doing', 'Review', 'Done'],
    cards: [],
    runs: [],
  };
}
