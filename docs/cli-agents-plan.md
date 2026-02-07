# Plan: Multi-CLI Agent Support for Kanban Board

## Summary

Add support for multiple CLI coding agents (Claude Code, GitHub Copilot CLI) in the Kanban board with per-card execution mode selection (headless vs interactive). Prompts are written to temp files in `.git/jira-prompts/`.

## Current State

- `AgentId` type already includes `'copilot' | 'codex' | 'claude-code'` (`src/board/types.ts:11`)
- Cards have `agent` field but it's not used in execution
- Queue system has pluggable executors via constructor injection (`src/orchestrator/queue.ts:34-38`)
- WebView has no agent selector UI (`media/kanban.js`)

## Implementation Steps

### Phase 1: Core Types & Agent Registry

**1.1 Create agent registry** (`src/agents/agentRegistry.ts` - NEW)
```typescript
export type ExecutionMode = 'headless' | 'interactive';

export interface CLIAgentConfig {
  id: AgentId;
  displayName: string;
  headless: { command: string; args: (prompt: string) => string[] } | null;
  interactive: { command: string; args: (promptFile: string) => string[] } | null;
}

export const AGENT_REGISTRY: Record<AgentId, CLIAgentConfig> = {
  'claude-code': {
    id: 'claude-code',
    displayName: 'Claude Code',
    headless: { command: 'claude', args: (p) => ['--print', p] },
    interactive: { command: 'claude', args: () => [] },
  },
  'copilot': {
    id: 'copilot',
    displayName: 'GitHub Copilot CLI',
    headless: { command: 'gh', args: (p) => ['copilot', 'suggest', p] },
    interactive: { command: 'gh', args: () => ['copilot'] },
  },
  'codex': { id: 'codex', displayName: 'Codex', headless: null, interactive: null },
};
```

**1.2 Extend types** (`src/board/types.ts`)
- Add `ExecutionMode = 'headless' | 'interactive'`
- Add `executionMode: ExecutionMode` to `KanbanCard`

**1.3 Extend schema** (`src/board/schema.ts`)
- Add to `BoardCard`: `executionMode`, `promptFilePath`
- Add to `RunRecord`: `agentId`, `executionMode`, `cliPid`, `outputCapture`

### Phase 2: Prompt File Management

**2.1 Create prompt file manager** (`src/agents/promptFileManager.ts` - NEW)
- `getPromptFilePath(cwd, cardId)` -> `.git/jira-prompts/<cardId>.md`
- `writePromptFile(cwd, card, prompt)` -> writes prompt with metadata header
- `readPromptFile(cwd, cardId)` -> reads prompt content
- `cleanupOldPromptFiles(cwd, maxAgeMs)` -> cleanup old files

### Phase 3: CLI Agent Executor

**3.1 Create CLI executor** (`src/agents/cliAgentExecutor.ts` - NEW)

```typescript
// Track active processes for cancellation
const activeProcesses = new Map<string, ChildProcess>();

export async function executeHeadless(cwd, card, runId, prompt, agentConfig) {
  // 1. Write prompt to file
  // 2. Spawn child_process with agent command
  // 3. Capture stdout/stderr
  // 4. Return CLIExecutionResult
}

export async function executeInteractive(cwd, card, runId, prompt, agentConfig) {
  // 1. Write prompt to file
  // 2. Create VS Code terminal: vscode.window.createTerminal()
  // 3. Send command to terminal
}

export function cancelRun(runId) {
  // Kill active process if exists
}
```

### Phase 4: Queue Integration

**4.1 Modify queue** (`src/orchestrator/queue.ts`)
- Add `cliAgentExecutor` to constructor
- Add `executionMode` and `useCliAgent` to `QueueJob`
- Add `runCLIAgentJob()` method that:
  - Builds prompt via existing executor
  - Dispatches to CLI agent instead of Copilot Chat
  - Updates RunRecord with CLI output

**4.2 Modify singleton** - Allow injection of CLI executor

### Phase 5: WebView UI

**5.1 Update kanban.js** (`media/kanban.js`)
- Add agent dropdown in toolbar (Claude Code, Copilot CLI)
- Add execution mode dropdown (Headless, Interactive)
- Include agent/mode in createCard message
- Show agent badge and mode indicator on cards
- Add "View Output" button for completed headless runs

**5.2 Update kanban.css** (`media/kanban.css`)
- Agent badge styles (`.agent-claude-code`, `.agent-copilot`)
- Execution mode indicators

### Phase 6: View Provider & Commands

**6.1 Update view provider** (`src/ui/kanbanViewProvider.ts`)
- Handle `agent` and `executionMode` in createCard
- Pass agent/mode through to runPromptRecipe
- Add `viewRunOutput` message handler

**6.2 Register commands** (`src/extension.ts`)
- `jiraSmartCommit.viewRunOutput` - open output in editor
- `jiraSmartCommit.cancelRun` - cancel active headless run

## Files to Create

| File | Purpose |
|------|---------|
| `src/agents/agentRegistry.ts` | CLI agent configurations |
| `src/agents/promptFileManager.ts` | Prompt file CRUD |
| `src/agents/cliAgentExecutor.ts` | CLI process spawning |
| `src/agents/outputViewer.ts` | Display CLI output |
| `src/agents/index.ts` | Barrel export |

## Files to Modify

| File | Changes |
|------|---------|
| `src/board/types.ts` | Add `ExecutionMode` type |
| `src/board/schema.ts` | Extend `BoardCard`, `RunRecord` |
| `src/orchestrator/queue.ts` | Add CLI executor support |
| `src/ui/kanbanViewProvider.ts` | Handle agent/mode messages |
| `media/kanban.js` | Agent selector, mode toggle UI |
| `media/kanban.css` | Agent badge styling |
| `src/extension.ts` | Register new commands |

## Verification Plan

1. **Unit Tests**
   - Test `promptFileManager` writes/reads correctly
   - Test `agentRegistry` returns correct configs
   - Test `cliAgentExecutor` spawns processes correctly (mock child_process)

2. **Integration Tests**
   - Create card with different agents -> verify stored correctly
   - Run card with headless mode -> verify prompt file created, output captured
   - Run card with interactive mode -> verify terminal opens

3. **Manual Testing**
   - Open Kanban board, create card with Claude Code agent
   - Select headless mode, run card -> verify background execution
   - Select interactive mode, run card -> verify terminal opens with prompt
   - Repeat with Copilot CLI agent
   - View run output after completion
   - Cancel running headless job

## Architecture Diagram

```
+-------------------+     +---------------------+     +-------------------+
|  Kanban WebView   |---->| kanbanViewProvider  |---->| PromptRunQueue    |
|  (kanban.js)      |     |                     |     |                   |
+-------------------+     +---------------------+     +---------+---------+
                                                                |
                          +-------------------------------------+------------------+
                          |                                     |                  |
                          v                                     v                  v
                +-----------------+                   +-----------------+   +----------------+
                | agentRegistry   |                   | recipeExecutor  |   | promptFile     |
                | (get config)    |                   | (build prompt)  |   | Manager        |
                +--------+--------+                   +--------+--------+   +--------+-------+
                         |                                     |                     |
                         v                                     v                     v
                +-----------------------------------------------------------------------+
                |                        cliAgentExecutor                               |
                |  +-------------------+                +--------------------+          |
                |  | Headless Mode     |                | Interactive Mode   |          |
                |  | (child_process)   |                | (vscode.Terminal)  |          |
                |  +---------+---------+                +--------------------+          |
                +------------+----------------------------------------------------------+
                             |
                             v
                +-------------------+
                | RunRecord         |
                | (output capture)  |
                +-------------------+
```
