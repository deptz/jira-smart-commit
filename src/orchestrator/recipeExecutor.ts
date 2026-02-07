import * as vscode from 'vscode';
import { DispatchMode, PromptRecipe } from '../board/types';
import { getPromptRecipe, PromptRecipeBuildInput } from './promptRecipes';

export type RecipeExecutionResult = {
  recipe: PromptRecipe;
  prompt: string;
  dispatchMode: DispatchMode;
  lintWarnings: string[];
};

async function dispatchToCopilot(prompt: string, mode: DispatchMode): Promise<void> {
  if (mode === 'autoSubmit') {
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: prompt,
    });
    return;
  }

  await vscode.env.clipboard.writeText(prompt);
  await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
}

export async function executePromptRecipe(input: {
  recipe: PromptRecipe;
  cwd?: string;
  buildInput?: PromptRecipeBuildInput;
  dispatchMode?: DispatchMode;
  dispatchToCopilotChat?: boolean;
}): Promise<RecipeExecutionResult> {
  const recipeDef = getPromptRecipe(input.recipe);

  const template = recipeDef.loadTemplate(input.cwd);
  if (!template || !template.trim()) {
    throw new Error(`Template for recipe '${input.recipe}' is not configured.`);
  }
  const lintWarnings = recipeDef.lintTemplate(template);

  const context = await recipeDef.buildContext({
    cwd: input.cwd,
    ...(input.buildInput ?? {}),
  });

  const prompt = recipeDef.render(template, context);
  const dispatchMode = input.dispatchMode ?? recipeDef.defaultDispatchMode;

  if (input.dispatchToCopilotChat) {
    await dispatchToCopilot(prompt, dispatchMode);
  }

  return {
    recipe: input.recipe,
    prompt,
    dispatchMode,
    lintWarnings,
  };
}
