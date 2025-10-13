
import fetch from 'node-fetch';
import { AiClient, AIConfig, AIPayload } from './aiProvider';

export class GeminiClient implements AiClient {
  constructor(private cfg: AIConfig, private apiKey: string) {}

  async generateCommit(p: AIPayload): Promise<string> {
    const model = encodeURIComponent(this.cfg.model || 'gemini-1.5-pro');
    const base = this.cfg.baseUrl?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com';
    const url = `${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${p.system}\n\n${p.user}` }] }
        ],
        generationConfig: {
          temperature: this.cfg.temperature,
          maxOutputTokens: this.cfg.maxTokens
        }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const out = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!out) throw new Error('Gemini returned no content.');
    return out;
  }
}
