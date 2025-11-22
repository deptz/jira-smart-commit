
export type AIConfig = {
  provider: 'openai' | 'azure-openai' | 'anthropic' | 'gemini' | 'ollama' | 'moonshot' | 'team-gateway';
  model: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
};

export type AIPayload = {
  system: string;
  user: string;
};

export interface AiClient {
  generateCommit(payload: AIPayload): Promise<string>;
}
