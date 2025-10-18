import * as vscode from 'vscode';
import { PRContext, PRGenerationResult, LanguageConfig } from './types';
import { getCurrentBranch, getBaseBranch, extractJiraKeyFromBranch, getCommitLog, getFileChanges, getRepositoryRoot } from './gitOperations';
import { detectProjectLanguage } from './languageDetector';
import { detectCoverage } from './coverageDetector';
import { generateSummarySection, generateChangesSection, generateTestingSection, generateImpactSection, generateNotesSection } from './sectionGenerator';
import { formatPRDescription, formatForPlatform } from './prFormatter';
import { validatePRDescription } from './prValidator';
import { calculateScore } from './scoreCalculator';
import { fetchIssue } from '../jiraClient';
import { enhancePRDescription, EnhancementLevel } from './aiPREnhancer';

/**
 * Main function to generate PR description
 */
export async function generatePRDescription(): Promise<PRGenerationResult> {
  // Check if feature is enabled
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const enabled = config.get('enabled', true) as boolean;
  
  if (!enabled) {
    throw new Error('PR Description Generator is disabled. Enable it in settings: jiraSmartCommit.pr.enabled');
  }
  
  // Step 1: Get Git information
  const currentBranch = await getCurrentBranch();
  const baseBranch = await getBaseBranch(currentBranch);
  
  // Step 2: Extract JIRA key from branch name
  const jiraKey = extractJiraKeyFromBranch(currentBranch);
  
  // Step 3: Fetch JIRA issue if key found
  let jiraIssue;
  if (jiraKey) {
    try {
      // Get JIRA configuration
      const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
      const baseUrl = jiraConfig.get('baseUrl') as string;
      const email = jiraConfig.get('email') as string;
      const context = (global as any).extensionContext;
      const apiToken = await context?.secrets.get('jiraApiToken');
      const fetchRelatedIssues = jiraConfig.get('fetchRelatedIssues', false) as boolean;
      
      if (baseUrl && email && apiToken) {
        jiraIssue = await fetchIssue({
          key: jiraKey,
          baseUrl,
          email,
          apiToken,
          fetchRelatedIssues
        });
      }
    } catch (error) {
      console.warn('Could not fetch JIRA issue:', error);
      // Continue without JIRA data
    }
  }
  
  // Step 4: Get commit log and file changes
  const commits = await getCommitLog(baseBranch);
  const fileChanges = await getFileChanges(baseBranch);
  
  if (commits.length === 0) {
    throw new Error('No commits found between current branch and base branch. Make sure you have commits to generate a PR description.');
  }
  
  // Step 5: Detect language and framework
  const workspaceRoot = getRepositoryRoot();
  const language = await detectProjectLanguage(workspaceRoot);
  
  // Step 6: Detect test coverage
  const coverage = await detectCoverage(workspaceRoot, language);
  
  // Step 7: Build context
  const context: PRContext = {
    currentBranch,
    baseBranch,
    jiraKey: jiraKey || undefined,
    jiraIssue,
    commits,
    fileChanges,
    language,
    coverage: coverage || undefined
  };
  
  // Step 8: Generate all sections
  const summary = await generateSummarySection(context);
  const changes = generateChangesSection(context);
  const testing = await generateTestingSection(context);
  const impact = generateImpactSection(context);
  const notes = generateNotesSection(context);
  
  // Step 9: Format PR description
  const platform = config.get('targetPlatform', 'bitbucket') as 'bitbucket' | 'github' | 'gitlab';
  let description = formatForPlatform(summary, changes, testing, impact, notes, context, platform);
  
  // Step 10: AI Enhancement (optional)
  const aiConfig = vscode.workspace.getConfiguration('jiraSmartCommit.pr.ai');
  const aiEnabled = aiConfig.get('enabled', false) as boolean;
  
  if (aiEnabled) {
    const level = aiConfig.get('enhanceLevel', 'balanced') as EnhancementLevel;
    try {
      description = await enhancePRDescription(description, context, level);
    } catch (error) {
      console.warn('AI enhancement failed, using original description:', error);
    }
  }
  
  // Step 11: Validate
  const validation = validatePRDescription(description);
  
  // Step 12: Calculate score
  const score = calculateScore(context, validation, description);
  validation.score = score;
  
  // Step 13: Build result
  const result: PRGenerationResult = {
    description,
    validation,
    estimatedScore: score,
    metadata: {
      commitsAnalyzed: commits.length,
      filesChanged: fileChanges.length,
      jiraAligned: !!jiraIssue,
      language: language?.language || 'unknown',
      coverageDetected: !!coverage
    }
  };
  
  return result;
}

/**
 * Generate PR description with progress reporting
 */
export async function generatePRDescriptionWithProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<PRGenerationResult> {
  progress.report({ message: 'Analyzing Git repository...', increment: 10 });
  
  // Check if feature is enabled
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const enabled = config.get('enabled', true) as boolean;
  
  if (!enabled) {
    throw new Error('PR Description Generator is disabled');
  }
  
  // Step 1: Get Git information
  const currentBranch = await getCurrentBranch();
  const baseBranch = await getBaseBranch(currentBranch);
  
  progress.report({ message: 'Extracting JIRA key from branch...', increment: 10 });
  
  // Step 2: Extract JIRA key
  const jiraKey = extractJiraKeyFromBranch(currentBranch);
  
  // Step 3: Fetch JIRA issue
  let jiraIssue;
  if (jiraKey) {
    progress.report({ message: `Fetching JIRA issue ${jiraKey}...`, increment: 10 });
    try {
      // Get JIRA configuration
      const jiraConfig = vscode.workspace.getConfiguration('jiraSmartCommit');
      const baseUrl = jiraConfig.get('baseUrl') as string;
      const email = jiraConfig.get('email') as string;
      const context = (global as any).extensionContext;
      const apiToken = await context?.secrets.get('jiraApiToken');
      const fetchRelatedIssues = jiraConfig.get('fetchRelatedIssues', false) as boolean;
      
      if (baseUrl && email && apiToken) {
        jiraIssue = await fetchIssue({
          key: jiraKey,
          baseUrl,
          email,
          apiToken,
          fetchRelatedIssues
        });
      }
    } catch (error) {
      console.warn('Could not fetch JIRA issue:', error);
    }
  }
  
  progress.report({ message: 'Analyzing commits and changes...', increment: 15 });
  
  // Step 4: Get commit log and file changes
  const commits = await getCommitLog(baseBranch);
  const fileChanges = await getFileChanges(baseBranch);
  
  if (commits.length === 0) {
    throw new Error('No commits found between branches');
  }
  
  progress.report({ message: 'Detecting project language...', increment: 10 });
  
  // Step 5: Detect language
  const workspaceRoot = getRepositoryRoot();
  const language = await detectProjectLanguage(workspaceRoot);
  
  progress.report({ message: 'Detecting test coverage...', increment: 10 });
  
  // Step 6: Detect coverage
  const coverage = await detectCoverage(workspaceRoot, language);
  
  progress.report({ message: 'Generating PR sections...', increment: 15 });
  
  // Build context
  const context: PRContext = {
    currentBranch,
    baseBranch,
    jiraKey: jiraKey || undefined,
    jiraIssue,
    commits,
    fileChanges,
    language,
    coverage: coverage || undefined
  };
  
  // Generate sections
  const summary = await generateSummarySection(context);
  const changes = generateChangesSection(context);
  const testing = await generateTestingSection(context);
  const impact = generateImpactSection(context);
  const notes = generateNotesSection(context);
  
  progress.report({ message: 'Formatting and validating...', increment: 10 });
  
  // Format and validate
  const platform = config.get('targetPlatform', 'bitbucket') as 'bitbucket' | 'github' | 'gitlab';
  let description = formatForPlatform(summary, changes, testing, impact, notes, context, platform);
  
  // AI Enhancement (optional)
  const aiConfig = vscode.workspace.getConfiguration('jiraSmartCommit.pr.ai');
  const aiEnabled = aiConfig.get('enabled', false) as boolean;
  
  if (aiEnabled) {
    progress.report({ message: 'Enhancing with AI...', increment: 5 });
    const level = aiConfig.get('enhanceLevel', 'balanced') as EnhancementLevel;
    try {
      description = await enhancePRDescription(description, context, level);
    } catch (error) {
      console.warn('AI enhancement failed, using original description:', error);
    }
  }
  
  const validation = validatePRDescription(description);
  
  progress.report({ message: 'Calculating quality score...', increment: 5 });
  
  // Calculate score
  const score = calculateScore(context, validation, description);
  validation.score = score;
  
  // Build result
  const result: PRGenerationResult = {
    description,
    validation,
    estimatedScore: score,
    metadata: {
      commitsAnalyzed: commits.length,
      filesChanged: fileChanges.length,
      jiraAligned: !!jiraIssue,
      language: language?.language || 'unknown',
      coverageDetected: !!coverage
    }
  };
  
  return result;
}
