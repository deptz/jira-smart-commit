
import fetch from 'node-fetch';
import { AiClient, AIConfig, AIPayload } from './aiProvider';

export class OpenAIClient implements AiClient {
  constructor(private cfg: AIConfig, private apiKey: string) {}

  async generateCommit(p: AIPayload): Promise<string> {
    const base = this.cfg.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const url = `${base}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.cfg.model,
        temperature: this.cfg.temperature,
        max_tokens: this.cfg.maxTokens,
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const out = json.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error('OpenAI returned no content.');
    return out;
  }
}
