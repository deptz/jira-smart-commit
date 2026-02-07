import { getFirstPromptConfigWithTeamDefaults, getPRConfigWithTeamDefaults, getSecurityConfigWithTeamDefaults, getTestCoverageConfigWithTeamDefaults } from '../aiConfigManager';
import { DispatchMode, PromptRecipe } from '../board/types';
import { JiraIssue } from '../types';
import { PRContext } from '../pr/types';
import {
  SecurityTemplateContext,
  buildFirstPromptTemplateContext,
  buildPRTemplateContext,
  buildSecurityTemplateContext,
} from './contextBuilders';
import { renderPromptTemplate } from './promptRenderer';
import { validateTemplatePlaceholders } from './templateValidation';

export type PromptRecipeBuildInput = {
  cwd?: string;
  issue?: JiraIssue;
  prContext?: PRContext;
  securityContext?: SecurityTemplateContext;
};

export interface PromptRecipeDefinition {
  id: PromptRecipe;
  loadTemplate: (cwd?: string) => string;
  allowedPlaceholders: string[];
  buildContext: (input: PromptRecipeBuildInput) => Promise<Record<string, string>>;
  render: (template: string, context: Record<string, string>) => string;
  defaultDispatchMode: DispatchMode;
  lintTemplate: (template: string) => string[];
}

const sharedRender = (template: string, context: Record<string, string>): string => {
  return renderPromptTemplate(template, context);
};

const firstPromptTaskRecipe: PromptRecipeDefinition = {
  id: 'firstPrompt.task',
  loadTemplate: (cwd?: string) => getFirstPromptConfigWithTeamDefaults(cwd).taskTemplate,
  allowedPlaceholders: ['DESCRIPTION'],
  buildContext: async (input: PromptRecipeBuildInput) => {
    if (!input.issue) {
      throw new Error('First Prompt task recipe requires a JIRA issue context.');
    }
    return buildFirstPromptTemplateContext(input.issue);
  },
  render: sharedRender,
  defaultDispatchMode: 'pasteOnly',
  lintTemplate: (template: string) =>
    validateTemplatePlaceholders(template, ['DESCRIPTION']).unknownPlaceholders,
};

const firstPromptBugRecipe: PromptRecipeDefinition = {
  id: 'firstPrompt.bug',
  loadTemplate: (cwd?: string) => getFirstPromptConfigWithTeamDefaults(cwd).bugTemplate,
  allowedPlaceholders: ['DESCRIPTION'],
  buildContext: async (input: PromptRecipeBuildInput) => {
    if (!input.issue) {
      throw new Error('First Prompt bug recipe requires a JIRA issue context.');
    }
    return buildFirstPromptTemplateContext(input.issue);
  },
  render: sharedRender,
  defaultDispatchMode: 'pasteOnly',
  lintTemplate: (template: string) =>
    validateTemplatePlaceholders(template, ['DESCRIPTION']).unknownPlaceholders,
};

const securityReviewRecipe: PromptRecipeDefinition = {
  id: 'security.review',
  loadTemplate: (cwd?: string) => getSecurityConfigWithTeamDefaults(cwd).promptTemplate,
  allowedPlaceholders: ['RECENT_COMMITS_DIFF', 'STAGED_CHANGES_DIFF', 'FRAMEWORK_CONTEXT'],
  buildContext: async (input: PromptRecipeBuildInput) => {
    const securityContext = input.securityContext ?? (input.cwd ? await buildSecurityTemplateContext(input.cwd) : undefined);
    if (!securityContext) {
      throw new Error('Security recipe requires workspace root (cwd) or pre-built security context.');
    }

    return {
      RECENT_COMMITS_DIFF: securityContext.recentCommitsDiff,
      STAGED_CHANGES_DIFF: securityContext.stagedChangesDiff,
      FRAMEWORK_CONTEXT: securityContext.frameworkContext,
    };
  },
  render: sharedRender,
  defaultDispatchMode: 'pasteOnly',
  lintTemplate: (template: string) =>
    validateTemplatePlaceholders(template, [
      'RECENT_COMMITS_DIFF',
      'STAGED_CHANGES_DIFF',
      'FRAMEWORK_CONTEXT',
    ]).unknownPlaceholders,
};

const testCoverageRecipe: PromptRecipeDefinition = {
  id: 'testCoverage.enforce',
  loadTemplate: (cwd?: string) => getTestCoverageConfigWithTeamDefaults(cwd).promptTemplate,
  allowedPlaceholders: [],
  buildContext: async () => ({}),
  render: sharedRender,
  defaultDispatchMode: 'pasteOnly',
  lintTemplate: (template: string) => validateTemplatePlaceholders(template, []).unknownPlaceholders,
};

const prDescriptionRecipe: PromptRecipeDefinition = {
  id: 'pr.description',
  loadTemplate: (cwd?: string) => getPRConfigWithTeamDefaults(cwd).promptTemplate,
  allowedPlaceholders: ['CONTEXT'],
  buildContext: async (input: PromptRecipeBuildInput) => {
    if (!input.prContext) {
      throw new Error('PR description recipe requires PR context.');
    }

    return buildPRTemplateContext(input.prContext);
  },
  render: sharedRender,
  defaultDispatchMode: 'pasteOnly',
  lintTemplate: (template: string) =>
    validateTemplatePlaceholders(template, ['CONTEXT']).unknownPlaceholders,
};

const prCreateBitbucketRecipe: PromptRecipeDefinition = {
  id: 'pr.createBitbucket',
  loadTemplate: () => 'Create Bitbucket pull request from temporary file.',
  allowedPlaceholders: [],
  buildContext: async () => ({}),
  render: sharedRender,
  defaultDispatchMode: 'pasteOnly',
  lintTemplate: () => [],
};

const recipeRegistry: Record<PromptRecipe, PromptRecipeDefinition> = {
  'firstPrompt.task': firstPromptTaskRecipe,
  'firstPrompt.bug': firstPromptBugRecipe,
  'security.review': securityReviewRecipe,
  'testCoverage.enforce': testCoverageRecipe,
  'pr.description': prDescriptionRecipe,
  'pr.createBitbucket': prCreateBitbucketRecipe,
};

export function getPromptRecipe(id: PromptRecipe): PromptRecipeDefinition {
  return recipeRegistry[id];
}

export function listPromptRecipes(): PromptRecipeDefinition[] {
  return Object.values(recipeRegistry);
}
