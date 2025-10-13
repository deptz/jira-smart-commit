
import fetch from 'node-fetch';
import { AiClient, AIConfig, AIPayload } from './aiProvider';

export class AnthropicClient implements AiClient {
  constructor(private cfg: AIConfig, private apiKey: string) {}

  async generateCommit(p: AIPayload): Promise<string> {
    const base = this.cfg.baseUrl?.replace(/\/$/, '') || 'https://api.anthropic.com';
    const url = `${base}/v1/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.cfg.model,
        max_tokens: this.cfg.maxTokens,
        temperature: this.cfg.temperature,
        system: p.system,
        messages: [{ role: 'user', content: p.user }]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const out = json.content?.[0]?.text?.trim();
    if (!out) throw new Error('Anthropic returned no content.');
    return out;
  }
}
