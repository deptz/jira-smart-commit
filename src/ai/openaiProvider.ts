
import fetch from 'node-fetch';
import { AiClient, AIConfig, AIPayload } from './aiProvider';

export class OpenAIClient implements AiClient {
  constructor(private cfg: AIConfig, private apiKey: string) {}

  private isGPT5Model(model: string): boolean {
    return model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
  }

  async generateCommit(p: AIPayload): Promise<string> {
    const base = this.cfg.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const isGPT5 = this.isGPT5Model(this.cfg.model);
    
    // Use Responses API for GPT-5.1 for better performance, fallback to Chat Completions for others
    const url = `${base}/${isGPT5 && this.cfg.model === 'gpt-5.1' ? 'responses' : 'chat/completions'}`;

    let requestBody: any;

    if (isGPT5 && this.cfg.model === 'gpt-5.1') {
      // Use Responses API for GPT-5.1 with optimal settings
      requestBody = {
        model: this.cfg.model,
        input: `${p.system}\n\n${p.user}`,
        max_output_tokens: this.cfg.maxTokens,
        reasoning: { effort: "none" }, // Fast responses for commit generation
        text: { verbosity: "medium" }   // Balanced verbosity for clear commit messages
      };
    } else {
      // Use Chat Completions API for other models
      requestBody = {
        model: this.cfg.model,
        max_completion_tokens: this.cfg.maxTokens,
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user }
        ]
      };

      // Only add temperature for non-GPT-5 models
      if (!isGPT5) {
        requestBody.temperature = this.cfg.temperature;
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }

    const json = await res.json();
    let out: string;

    if (isGPT5 && this.cfg.model === 'gpt-5.1') {
      // Handle Responses API response format
      out = json.output_text?.trim();
    } else {
      // Handle Chat Completions API response format
      out = json.choices?.[0]?.message?.content?.trim();
    }

    if (!out) throw new Error('OpenAI returned no content.');
    return out;
  }
}
