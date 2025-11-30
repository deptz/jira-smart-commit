
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * AI configuration that can be shared across team via .jira-smart-commit.json
 * This allows teams to centralize provider, model, and gateway settings while
 * keeping individual API keys secure in VS Code SecretStorage.
 */
export type TeamAIConfig = {
  provider?: 'openai' | 'azure-openai' | 'anthropic' | 'gemini' | 'ollama' | 'moonshot' | 'team-gateway';
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  userPromptTemplate?: string;
  format?: 'conventional' | 'plain';
  language?: string;
  teamGatewayRequiresAuth?: boolean;
};

const CONFIG_FILE_NAME = '.jira-smart-commit.json';

/**
 * Load AI configuration from team config file if it exists.
 * This allows teams to standardize on a provider/model/gateway.
 */
export function loadTeamAIConfig(cwd: string): TeamAIConfig | undefined {
  try {
    const configPath = path.join(cwd, CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      return config.ai;
    }
  } catch (error) {
    console.warn(`Failed to load AI config from ${CONFIG_FILE_NAME}:`, error);
  }
  return undefined;
}

/**
 * Get AI configuration with proper precedence:
 * 1. User settings (VS Code configuration)
 * 2. Team config (.jira-smart-commit.json)
 * 3. Defaults
 */
export function getAIConfigWithTeamDefaults(cwd?: string): {
  provider: 'openai' | 'azure-openai' | 'anthropic' | 'gemini' | 'ollama' | 'moonshot' | 'team-gateway';
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  userPromptTemplate: string;
  format: 'conventional' | 'plain';
  language: string;
  teamGatewayRequiresAuth: boolean;
} {
  const userConfig = vscode.workspace.getConfiguration('jiraSmartCommit.ai');
  
  // Load team config if available
  let teamConfig: TeamAIConfig | undefined;
  if (cwd) {
    teamConfig = loadTeamAIConfig(cwd);
  } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    teamConfig = loadTeamAIConfig(vscode.workspace.workspaceFolders[0].uri.fsPath);
  }

  // Merge with precedence: user settings > team config > defaults
  return {
    provider: userConfig.get<any>('provider') || teamConfig?.provider || 'openai',
    model: userConfig.get<string>('model') || teamConfig?.model || 'gpt-4o-mini',
    baseUrl: userConfig.get<string>('baseUrl') || teamConfig?.baseUrl || '',
    maxTokens: userConfig.get<number>('maxTokens') ?? teamConfig?.maxTokens ?? 256,
    temperature: userConfig.get<number>('temperature') ?? teamConfig?.temperature ?? 0.2,
    systemPrompt: userConfig.get<string>('systemPrompt') || teamConfig?.systemPrompt || '',
    userPromptTemplate: userConfig.get<string>('userPromptTemplate') || teamConfig?.userPromptTemplate || '',
    format: userConfig.get<'conventional' | 'plain'>('format') || teamConfig?.format || 'conventional',
    language: userConfig.get<string>('language') || teamConfig?.language || 'en',
    teamGatewayRequiresAuth: userConfig.get<boolean>('teamGatewayRequiresAuth') ?? teamConfig?.teamGatewayRequiresAuth ?? false
  };
}

/**
 * PR-specific configuration that can be shared across team
 */
export type TeamPRConfig = {
  promptTemplate?: string;
  autoSubmit?: boolean;
};

/**
 * FirstPrompt-specific configuration that can be shared across team
 */
export type TeamFirstPromptConfig = {
  autoSubmit?: boolean;
  taskTemplate?: string;
  bugTemplate?: string;
};

/**
 * Security-specific configuration that can be shared across team
 */
export type TeamSecurityConfig = {
  promptTemplate?: string;
  autoSubmit?: boolean;
};

/**
 * Get PR configuration with team defaults
 */
export function getPRConfigWithTeamDefaults(cwd?: string): {
  promptTemplate: string;
  autoSubmit: boolean;
} {
  const userConfig = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  
  // Load team config if available
  let teamConfig: TeamPRConfig | undefined;
  if (cwd) {
    const config = loadFullTeamConfig(cwd);
    teamConfig = config?.pr;
  } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const config = loadFullTeamConfig(vscode.workspace.workspaceFolders[0].uri.fsPath);
    teamConfig = config?.pr;
  }

  return {
    promptTemplate: userConfig.get<string>('promptTemplate') || teamConfig?.promptTemplate || '',
    autoSubmit: userConfig.get<boolean>('autoSubmit') ?? teamConfig?.autoSubmit ?? false
  };
}

/**
 * Get FirstPrompt configuration with team defaults
 */
export function getFirstPromptConfigWithTeamDefaults(cwd?: string): {
  autoSubmit: boolean;
  taskTemplate: string;
  bugTemplate: string;
} {
  const userConfig = vscode.workspace.getConfiguration('jiraSmartCommit.firstPrompt');
  
  // Load team config if available
  let teamConfig: TeamFirstPromptConfig | undefined;
  if (cwd) {
    const config = loadFullTeamConfig(cwd);
    teamConfig = config?.firstPrompt;
  } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const config = loadFullTeamConfig(vscode.workspace.workspaceFolders[0].uri.fsPath);
    teamConfig = config?.firstPrompt;
  }

  return {
    autoSubmit: userConfig.get<boolean>('autoSubmit') ?? teamConfig?.autoSubmit ?? false,
    taskTemplate: userConfig.get<string>('taskTemplate') || teamConfig?.taskTemplate || '',
    bugTemplate: userConfig.get<string>('bugTemplate') || teamConfig?.bugTemplate || ''
  };
}

/**
 * Get Security configuration with team defaults
 */
export function getSecurityConfigWithTeamDefaults(cwd?: string): {
  promptTemplate: string;
  autoSubmit: boolean;
} {
  const userConfig = vscode.workspace.getConfiguration('jiraSmartCommit.security');
  
  // Load team config if available
  let teamConfig: TeamSecurityConfig | undefined;
  if (cwd) {
    const config = loadFullTeamConfig(cwd);
    teamConfig = config?.security;
  } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const config = loadFullTeamConfig(vscode.workspace.workspaceFolders[0].uri.fsPath);
    teamConfig = config?.security;
  }

  return {
    promptTemplate: userConfig.get<string>('promptTemplate') || teamConfig?.promptTemplate || '',
    autoSubmit: userConfig.get<boolean>('autoSubmit') ?? teamConfig?.autoSubmit ?? false
  };
}

/**
 * Load full team configuration (not just AI config)
 */
function loadFullTeamConfig(cwd: string): any | undefined {
  try {
    const configPath = path.join(cwd, CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`Failed to load team config from ${CONFIG_FILE_NAME}:`, error);
  }
  return undefined;
}
