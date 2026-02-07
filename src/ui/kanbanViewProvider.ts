import * as vscode from 'vscode';
import { deleteCard, loadBoard, upsertCard, updateCard } from '../board/store';
import { BoardCard, BoardColumn, KanbanBoardState } from '../board/schema';
import { PromptRecipe } from '../board/types';
import { runPromptRecipeCommand } from '../commands/runPromptRecipe';
import { getActiveRepository, pickRepository } from '../utils';

const COLUMNS: BoardColumn[] = ['Backlog', 'Ready', 'Doing', 'Review', 'Done'];

function nonce(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function isPromptRecipe(value: string): value is PromptRecipe {
  return (
    value === 'firstPrompt.task' ||
    value === 'firstPrompt.bug' ||
    value === 'security.review' ||
    value === 'testCoverage.enforce' ||
    value === 'pr.description' ||
    value === 'pr.createBitbucket'
  );
}

function normalizeRunRecipe(recipe: string): 'firstPrompt.auto' | PromptRecipe {
  if (!isPromptRecipe(recipe)) {
    return 'testCoverage.enforce';
  }
  if (recipe === 'firstPrompt.task' || recipe === 'firstPrompt.bug') {
    return 'firstPrompt.auto';
  }
  return recipe;
}

function toWebviewState(board: KanbanBoardState) {
  return {
    columns: board.columns,
    cards: board.cards,
    runs: board.runs.slice(-30).reverse(),
    updatedAt: board.updatedAt,
  };
}

async function resolveRepoCwd(): Promise<string | undefined> {
  const active = await getActiveRepository();
  if (active?.cwd) {
    return active.cwd;
  }
  const picked = await pickRepository();
  return picked?.cwd;
}

function ensureColumn(input: string): BoardColumn {
  return COLUMNS.includes(input as BoardColumn) ? (input as BoardColumn) : 'Backlog';
}

export async function openKanbanViewCommand(context: vscode.ExtensionContext): Promise<void> {
  const cwd = await resolveRepoCwd();
  if (!cwd) {
    throw new Error('No Git repository found or selected.');
  }

  const panel = vscode.window.createWebviewPanel('jiraSmartCommit.kanban', 'JIRA Smart Commit: Kanban', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
  });

  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'kanban.js'));
  const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'kanban.css'));
  const n = nonce();

  panel.webview.html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${n}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}">
    <title>Kanban</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${n}">window.__KANBAN_BOOTSTRAP__ = ${JSON.stringify({ cwd })};</script>
    <script nonce="${n}" src="${scriptUri}"></script>
  </body>
</html>`;

  const postBoard = () => {
    const board = loadBoard(cwd);
    panel.webview.postMessage({ type: 'boardState', payload: toWebviewState(board) });
  };

  const refreshTimer = setInterval(() => {
    const board = loadBoard(cwd);
    const hasActiveRuns = board.runs.some((r) => r.status === 'pending' || r.status === 'running');
    if (hasActiveRuns) {
      panel.webview.postMessage({ type: 'boardState', payload: toWebviewState(board) });
    }
  }, 1500);

  panel.onDidDispose(() => {
    clearInterval(refreshTimer);
  });

  panel.webview.onDidReceiveMessage(async (msg: any) => {
    switch (msg?.type) {
      case 'load':
        postBoard();
        break;
      case 'createCard': {
        const recipe = msg.payload?.recipe as PromptRecipe;
        const title = String(msg.payload?.title || '').trim();
        if (!title || !recipe) {
          break;
        }

        const id = msg.payload?.id || `${recipe}:${Date.now()}`;
        const card: BoardCard = {
          id,
          title,
          recipe,
          agent: 'copilot',
          jiraKey: msg.payload?.jiraKey ? String(msg.payload.jiraKey) : undefined,
          column: 'Backlog',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        upsertCard(cwd, card);
        postBoard();
        break;
      }
      case 'moveCard': {
        const cardId = String(msg.payload?.cardId || '');
        const column = ensureColumn(String(msg.payload?.column || 'Backlog'));
        if (!cardId) {
          break;
        }
        updateCard(cwd, cardId, { column });
        postBoard();
        break;
      }
      case 'editCard': {
        const cardId = String(msg.payload?.cardId || '');
        if (!cardId) {
          break;
        }
        const patch: Partial<BoardCard> = {};
        if (typeof msg.payload?.title === 'string') {
          patch.title = msg.payload.title.trim();
        }
        if (typeof msg.payload?.jiraKey === 'string') {
          patch.jiraKey = msg.payload.jiraKey.trim() || undefined;
        }
        if (typeof msg.payload?.recipe === 'string' && isPromptRecipe(msg.payload.recipe)) {
          patch.recipe = msg.payload.recipe;
        }
        updateCard(cwd, cardId, patch);
        postBoard();
        break;
      }
      case 'deleteCard': {
        const cardId = String(msg.payload?.cardId || '');
        if (!cardId) {
          break;
        }
        deleteCard(cwd, cardId);
        postBoard();
        break;
      }
      case 'runCard': {
        const cardId = String(msg.payload?.cardId || '');
        const board = loadBoard(cwd);
        const card = board.cards.find((c) => c.id === cardId);
        if (!card) {
          break;
        }
        await runPromptRecipeCommand({
          cwd,
          recipe: normalizeRunRecipe(card.recipe),
          cardId: card.id,
          cardTitle: card.title,
          enqueue: true,
          dryRun: false,
        });
        postBoard();
        break;
      }
      case 'openPr': {
        const cardId = String(msg.payload?.cardId || '');
        const board = loadBoard(cwd);
        const card = board.cards.find((c) => c.id === cardId);
        if (!card?.prUrl) {
          break;
        }
        await vscode.env.openExternal(vscode.Uri.parse(card.prUrl));
        break;
      }
      case 'previewCard': {
        const cardId = String(msg.payload?.cardId || '');
        const board = loadBoard(cwd);
        const card = board.cards.find((c) => c.id === cardId);
        if (!card) {
          break;
        }
        await runPromptRecipeCommand({
          cwd,
          recipe: normalizeRunRecipe(card.recipe),
          cardId: card.id,
          cardTitle: card.title,
          enqueue: false,
          dryRun: true,
        });
        break;
      }
      case 'refresh':
        postBoard();
        break;
      default:
        break;
    }
  });

  postBoard();
}
