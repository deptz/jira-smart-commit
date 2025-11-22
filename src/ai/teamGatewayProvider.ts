
import fetch from 'node-fetch';
import { AiClient, AIConfig, AIPayload } from './aiProvider';

export class TeamGatewayClient implements AiClient {
  constructor(private cfg: AIConfig, private apiKey?: string) { }

  async generateCommit(p: AIPayload): Promise<string> {
    if (!this.cfg.baseUrl) {
      throw new Error('Team gateway requires baseUrl to be configured. Set jiraSmartCommit.ai.baseUrl in settings or .jira-smart-commit.json');
    }

    const base = this.cfg.baseUrl.replace(/\/$/, '');
    const url = `${base}/chat/completions`;

    const headers: Record<string, string> = {
      'content-type': 'application/json'
    };

    // Add authorization if API key is provided
    if (this.apiKey) {
      headers['authorization'] = `Bearer ${this.apiKey}`;
    }

    // Add usage tracking metadata headers if provided
    if (p.metadata) {
      headers['x-feature-type'] = p.metadata.feature;
      headers['x-metadata-version'] = p.metadata.metadataVersion;
      headers['x-user-email'] = p.metadata.user;
      headers['x-request-id'] = p.metadata.requestId;
      headers['x-timestamp'] = p.metadata.timestamp;
      
      if (p.metadata.jiraKey) {
        headers['x-jira-key'] = p.metadata.jiraKey;
      }
      if (p.metadata.repository) {
        headers['x-repository'] = p.metadata.repository;
      }
      if (p.metadata.branch) {
        headers['x-branch'] = p.metadata.branch;
      }
    }

    const requestBody: any = {
      model: this.cfg.model,
      max_tokens: this.cfg.maxTokens,
      temperature: this.cfg.temperature,
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: p.user }
      ]
    };

    // Include metadata in request body if provided
    if (p.metadata) {
      requestBody.metadata = p.metadata;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Team Gateway error ${res.status}: ${text}`);
    }

    const json = await res.json();
    
    // Support both OpenAI format and potential custom formats
    const content = json.choices?.[0]?.message?.content || 
                   json.content?.[0]?.text ||
                   json.output ||
                   json.text;
    
    if (!content) {
      throw new Error('Team Gateway returned no content. Response: ' + JSON.stringify(json));
    }

    return content.trim();
  }
}
