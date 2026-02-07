export type PromptRecipe =
  | 'firstPrompt.task'
  | 'firstPrompt.bug'
  | 'security.review'
  | 'testCoverage.enforce'
  | 'pr.description'
  | 'pr.createBitbucket';

export type DispatchMode = 'autoSubmit' | 'pasteOnly';

export type AgentId = 'copilot' | 'codex' | 'claude-code';

export interface KanbanCard {
  id: string;
  title: string;
  recipe: PromptRecipe;
  agent: AgentId;
  jiraKey?: string;
}
