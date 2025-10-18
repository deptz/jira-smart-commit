import * as vscode from 'vscode';
import { PRContext } from './types';
import { getAiClient, callAI } from '../ai';
import { AIConfig, AIPayload } from '../ai/aiProvider';

/**
 * Enhancement levels
 */
export type EnhancementLevel = 'minimal' | 'balanced' | 'detailed';

/**
 * AI-enhance a PR description
 */
export async function enhancePRDescription(
  originalDescription: string,
  context: PRContext,
  level: EnhancementLevel = 'balanced'
): Promise<string> {
  // Check if AI is enabled
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr.ai');
  const aiEnabled = config.get('enabled', false) as boolean;
  
  if (!aiEnabled) {
    return originalDescription;
  }
  
  // Get extension context and AI configuration
  const extensionContext = (global as any).extensionContext;
  if (!extensionContext) {
    console.warn('Extension context not available for AI enhancement');
    return originalDescription;
  }
  
  const aiConfig = await getAIConfiguration();
  
  try {
    const client = await getAiClient(extensionContext, aiConfig);
    
    // Build enhancement prompt
    const systemPrompt = buildSystemPrompt(level);
    const userPrompt = buildUserPrompt(originalDescription, context, level);
    
    const payload: AIPayload = {
      system: systemPrompt,
      user: userPrompt
    };
    
    // Call AI to enhance
    const enhanced = await callAI(client, payload);
    
    // Validate enhanced description
    if (isValidEnhancedDescription(enhanced)) {
      return enhanced;
    } else {
      console.warn('AI returned invalid description, using original');
      return originalDescription;
    }
  } catch (error) {
    console.error('Failed to enhance PR description with AI:', error);
    return originalDescription;
  }
}

/**
 * Enhance a specific section with AI
 */
export async function enhanceSection(
  sectionName: string,
  sectionContent: string,
  context: PRContext,
  level: EnhancementLevel = 'balanced'
): Promise<string> {
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr.ai');
  const aiEnabled = config.get('enabled', false) as boolean;
  
  if (!aiEnabled) {
    return sectionContent;
  }
  
  const extensionContext = (global as any).extensionContext;
  if (!extensionContext) {
    return sectionContent;
  }
  
  const aiConfig = await getAIConfiguration();
  
  try {
    const client = await getAiClient(extensionContext, aiConfig);
    
    const systemPrompt = buildSectionSystemPrompt(sectionName, level);
    const userPrompt = buildSectionUserPrompt(sectionName, sectionContent, context);
    
    const payload: AIPayload = {
      system: systemPrompt,
      user: userPrompt
    };
    
    const enhanced = await callAI(client, payload);
    return enhanced || sectionContent;
  } catch (error) {
    console.error(`Failed to enhance ${sectionName} section:`, error);
    return sectionContent;
  }
}

/**
 * Build system prompt for PR enhancement
 */
function buildSystemPrompt(level: EnhancementLevel): string {
  const basePractices = `You are an expert technical writer specializing in pull request descriptions.
Your task is to enhance PR descriptions to be clear, comprehensive, and actionable.

Key principles:
- Use clear, concise language
- Maintain technical accuracy
- Keep existing structure and markdown formatting
- Preserve all JIRA references and links
- Focus on readability and reviewer understanding
- Add context where helpful but avoid verbosity`;

  const levelGuidance: Record<EnhancementLevel, string> = {
    minimal: `
Enhancement level: MINIMAL
- Fix grammar and spelling only
- Improve sentence structure slightly
- Keep all technical details as-is
- Minimal rewording`,
    balanced: `
Enhancement level: BALANCED
- Improve clarity and flow
- Add helpful context where missing
- Reorganize for better readability
- Enhance technical explanations
- Keep concise and focused`,
    detailed: `
Enhancement level: DETAILED
- Provide comprehensive explanations
- Add architectural context
- Include implementation details
- Explain trade-offs and decisions
- Anticipate reviewer questions
- Ensure all sections are thorough`
  };

  return `${basePractices}\n${levelGuidance[level]}`;
}

/**
 * Build user prompt for PR enhancement
 */
function buildUserPrompt(
  originalDescription: string,
  context: PRContext,
  level: EnhancementLevel
): string {
  const lines: string[] = [
    'Please enhance the following PR description:',
    ''
  ];
  
  // Add context
  if (context.jiraIssue) {
    lines.push(`JIRA Context: ${context.jiraIssue.key} - ${context.jiraIssue.summary}`);
  }
  lines.push(`Branch: ${context.currentBranch} → ${context.baseBranch}`);
  lines.push(`Commits: ${context.commits.length}`);
  lines.push(`Files Changed: ${context.fileChanges.length}`);
  
  if (context.language) {
    const framework = context.language.framework ? ` (${context.language.framework})` : '';
    lines.push(`Language: ${context.language.language}${framework}`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('ORIGINAL PR DESCRIPTION:');
  lines.push('');
  lines.push(originalDescription);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('INSTRUCTIONS:');
  lines.push('1. Keep the same section structure (## Summary, ## What Changed, etc.)');
  lines.push('2. Preserve all markdown formatting, links, and JIRA references');
  lines.push('3. Enhance clarity, grammar, and flow');
  lines.push('4. Add helpful context where appropriate');
  lines.push('5. Return ONLY the enhanced PR description (no explanations)');
  
  return lines.join('\n');
}

/**
 * Build system prompt for section enhancement
 */
function buildSectionSystemPrompt(sectionName: string, level: EnhancementLevel): string {
  const sectionGuidance: Record<string, string> = {
    'Summary': 'Provide clear overview of changes. Include JIRA context and high-level impact.',
    'What Changed': 'Organize changes logically. Group by type. Be specific about what was modified.',
    'Testing': 'Provide clear, actionable test instructions. Include setup steps and expected outcomes.',
    'Impact & Risks': 'Highlight breaking changes, migration needs, and deployment considerations.',
    'Additional Notes': 'Include technical details, related issues, and any important context.'
  };
  
  return `You are enhancing the "${sectionName}" section of a PR description.
${sectionGuidance[sectionName] || 'Improve clarity and completeness.'}

Return ONLY the enhanced section content (without the section header).
Maintain markdown formatting and preserve all links.`;
}

/**
 * Build user prompt for section enhancement
 */
function buildSectionUserPrompt(
  sectionName: string,
  sectionContent: string,
  context: PRContext
): string {
  return `Enhance this "${sectionName}" section:

${sectionContent}

Context: ${context.commits.length} commits, ${context.fileChanges.length} files changed.`;
}

/**
 * Get AI configuration (inherits from parent or uses PR-specific)
 */
async function getAIConfiguration(): Promise<AIConfig> {
  const parentConfig = vscode.workspace.getConfiguration('jiraSmartCommit.ai');
  const prConfig = vscode.workspace.getConfiguration('jiraSmartCommit.pr.ai');
  
  const provider = (prConfig.get('provider') || parentConfig.get('provider', 'openai')) as 'openai' | 'azure-openai' | 'anthropic' | 'gemini' | 'ollama';
  const model = (prConfig.get('model') || parentConfig.get('model', 'gpt-4o-mini')) as string;
  const baseUrl = (prConfig.get('baseUrl') || parentConfig.get('baseUrl', '')) as string;
  const maxTokens = parentConfig.get('maxTokens', 1000) as number;
  const temperature = 0.3; // Fixed for PR enhancement
  
  return {
    provider,
    model,
    baseUrl,
    maxTokens,
    temperature,
    systemPrompt: '' // Will be provided in payload
  };
}

/**
 * Get max tokens based on enhancement level
 */
function getMaxTokensForLevel(level: EnhancementLevel): number {
  const tokenLimits: Record<EnhancementLevel, number> = {
    minimal: 800,
    balanced: 1500,
    detailed: 2500
  };
  return tokenLimits[level];
}

/**
 * Validate enhanced description
 */
function isValidEnhancedDescription(description: string): boolean {
  if (!description || description.trim().length === 0) {
    return false;
  }
  
  // Check for required sections
  const requiredSections = [
    '## Summary',
    '## What Changed',
    '## Testing',
    '## Impact',
    '## Additional Notes'
  ];
  
  for (const section of requiredSections) {
    if (!description.includes(section)) {
      return false;
    }
  }
  
  // Check minimum length
  if (description.length < 500) {
    return false;
  }
  
  return true;
}

/**
 * Compare original and enhanced descriptions
 */
export function compareDescriptions(original: string, enhanced: string): {
  lengthDiff: number;
  sectionsImproved: string[];
  improvements: string[];
} {
  const lengthDiff = enhanced.length - original.length;
  const sectionsImproved: string[] = [];
  const improvements: string[] = [];
  
  // Check each section for improvements
  const sections = ['Summary', 'What Changed', 'Testing', 'Impact', 'Additional Notes'];
  
  for (const section of sections) {
    const originalSection = extractSection(original, section);
    const enhancedSection = extractSection(enhanced, section);
    
    if (enhancedSection.length > originalSection.length * 1.1) {
      sectionsImproved.push(section);
    }
  }
  
  // General improvements
  if (lengthDiff > 200) {
    improvements.push('Added more detailed explanations');
  }
  if (enhanced.includes('**') && !original.includes('**')) {
    improvements.push('Enhanced formatting for emphasis');
  }
  
  return { lengthDiff, sectionsImproved, improvements };
}

/**
 * Extract a section from PR description
 */
function extractSection(description: string, sectionName: string): string {
  const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = description.match(regex);
  return match ? match[1].trim() : '';
}
