
import * as vscode from 'vscode';
import { ConfigPreset } from './types';

/**
 * Predefined branch pattern presets for common workflows
 */
export const CONFIG_PRESETS: Record<string, ConfigPreset> = {
  'standard': {
    name: 'Standard',
    description: 'Flexible pattern that searches anywhere in branch name',
    branchPatterns: [/([A-Z]+-\d+)/i],
    baseBranches: ['main', 'master', 'develop']
  },
  'feature-based': {
    name: 'Feature-based',
    description: 'Git-flow style with feature/bugfix/hotfix prefixes',
    branchPatterns: [
      /^feature\/([A-Z]+-\d+)/i,
      /^bugfix\/([A-Z]+-\d+)/i,
      /^hotfix\/([A-Z]+-\d+)/i
    ],
    baseBranches: ['develop', 'main', 'master']
  },
  'user-based': {
    name: 'User-based',
    description: 'User forks with JIRA keys (username/ABC-123-description)',
    branchPatterns: [/^[^\/]+\/([A-Z]+-\d+)/i],
    baseBranches: ['main', 'master', 'develop']
  }
};

/**
 * Get branch patterns from configuration
 * Returns configured patterns or default preset patterns
 */
export function getBranchPatterns(): RegExp[] {
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const preset = config.get<string>('branchPatternPreset', 'standard');
  
  // If custom preset, get custom patterns
  if (preset === 'custom') {
    const customPatterns = config.get<string[]>('customBranchPatterns', []);
    if (customPatterns.length > 0) {
      try {
        return customPatterns.map(pattern => new RegExp(pattern));
      } catch (error) {
        console.error('Invalid custom branch pattern:', error);
        // Fall back to standard
        return CONFIG_PRESETS['standard'].branchPatterns;
      }
    }
  }
  
  // Return preset patterns
  const presetConfig = CONFIG_PRESETS[preset];
  return presetConfig ? presetConfig.branchPatterns : CONFIG_PRESETS['standard'].branchPatterns;
}

/**
 * Get default base branches from configuration
 */
export function getDefaultBaseBranches(): string[] {
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  return config.get<string[]>('defaultBaseBranches', ['main', 'master', 'develop']);
}

/**
 * Validate a branch pattern string (for custom patterns)
 */
export function validateBranchPattern(pattern: string): { valid: boolean; error?: string } {
  if (!pattern || pattern.trim().length === 0) {
    return { valid: false, error: 'Pattern cannot be empty' };
  }
  
  try {
    const regex = new RegExp(pattern);
    // Test if pattern has a capture group
    const testMatch = regex.exec('TEST-123');
    if (!testMatch || (!testMatch[1] && !testMatch.groups)) {
      return { 
        valid: false, 
        error: 'Pattern must have a capture group for JIRA key (use parentheses or named groups)' 
      };
    }
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: `Invalid regex: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Apply a configuration preset to workspace settings
 */
export async function applyConfigPreset(presetName: string): Promise<void> {
  const preset = CONFIG_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }
  
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  await config.update('branchPatternPreset', presetName, vscode.ConfigurationTarget.Workspace);
  await config.update('defaultBaseBranches', preset.baseBranches, vscode.ConfigurationTarget.Workspace);
  
  vscode.window.showInformationMessage(
    `Applied "${preset.name}" preset: ${preset.description}`
  );
}

/**
 * Get current preset name
 */
export function getCurrentPreset(): string {
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  return config.get<string>('branchPatternPreset', 'standard');
}
