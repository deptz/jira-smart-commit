
import * as vscode from 'vscode';
import { AIConfig, AiClient, AIPayload } from './aiProvider';
import { OpenAIClient } from './openaiProvider';
import { AnthropicClient } from './anthropicProvider';
import { GeminiClient } from './geminiProvider';
import { OllamaClient } from './ollamaProvider';
import { getApiKey } from '../aiKeyManager';

export async function getAiClient(context: vscode.ExtensionContext, cfg: AIConfig): Promise<AiClient> {
  switch (cfg.provider) {
    case 'openai': {
      const key = await getApiKey(context, 'OpenAI');
      return new OpenAIClient(cfg, key);
    }
    case 'azure-openai': {
      const key = await getApiKey(context, 'Azure OpenAI');
      return new OpenAIClient(cfg, key);
    }
    case 'anthropic': {
      const key = await getApiKey(context, 'Anthropic');
      return new AnthropicClient(cfg, key);
    }
    case 'gemini': {
      const key = await getApiKey(context, 'Gemini');
      return new GeminiClient(cfg, key);
    }
    case 'ollama': {
      return new OllamaClient(cfg);
    }
    default:
      throw new Error(`Unsupported provider: ${cfg.provider}`);
  }
}

export async function callAI(client: AiClient, payload: AIPayload): Promise<string> {
  const tries = [0, 300, 800];
  let lastErr: any;
  for (const delay of tries) {
    if (delay) await new Promise(r => setTimeout(r, delay));
    try {
      const out = await client.generateCommit(payload);
      return out.replace(/^```[\\w-]*\\n?/g, '').replace(/```$/g, '').trim();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
