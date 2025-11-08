import fetch from 'node-fetch';
import { AiClient, AIConfig, AIPayload } from './aiProvider';

export class MoonshotClient implements AiClient {
  constructor(private cfg: AIConfig, private apiKey: string) {}

  async generateCommit(p: AIPayload): Promise<string> {
    const base = this.cfg.baseUrl?.replace(/\/$/, '') || 'https://api.moonshot.cn/v1';
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
      throw new Error(`Moonshot error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const out = json.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error('Moonshot returned no content.');
    return out;
  }
}