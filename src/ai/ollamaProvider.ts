
import fetch from 'node-fetch';
import { AiClient, AIConfig, AIPayload } from './aiProvider';

export class OllamaClient implements AiClient {
  constructor(private cfg: AIConfig) {}

  async generateCommit(p: AIPayload): Promise<string> {
    const base = this.cfg.baseUrl?.replace(/\/$/, '') || 'http://localhost:11434';
    const url = `${base}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.cfg.model,
        temperature: this.cfg.temperature,
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const out = json.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error('Ollama returned no content.');
    return out;
  }
}
