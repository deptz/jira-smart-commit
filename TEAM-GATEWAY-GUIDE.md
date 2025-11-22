# Team Gateway Configuration Guide

This guide explains how to configure a centralized team gateway for LLM providers in JIRA Smart Commit.

## Overview

The **Team Gateway** feature allows teams to:
- Use a single, centralized endpoint for all LLM requests
- Standardize on the same provider and model across the team
- Centralize cost tracking and usage monitoring
- Enforce compliance and security policies
- Cache common responses for better performance

---

## Quick Start (5 Minutes)

### Option A: Use Existing Service

If you have an OpenAI-compatible API service already:

```bash
# Just configure the URL in your repo
echo '{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://your-gateway.com/v1",
    "model": "gpt-5.1"
  }
}' > .jira-smart-commit.json

git add .jira-smart-commit.json
git commit -m "chore: add team gateway config"
git push
```

Done! All team members will now use the gateway.

### Option B: Deploy Your Own Gateway

You'll need to implement an OpenAI-compatible gateway. See the **Gateway Requirements** and **Example Gateway Implementations** sections below for details.

Once deployed, configure it in your repo:

```bash
echo '{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.yourteam.com/v1",
    "model": "gpt-5.1"
  }
}' > .jira-smart-commit.json

git add .jira-smart-commit.json
git commit -m "chore: add team gateway config"
git push
```

### Test Your Gateway

```bash
# Test with curl
curl -X POST https://gateway.yourteam.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.1",
    "max_tokens": 100,
    "messages": [
      {"role": "system", "content": "You are a commit message generator."},
      {"role": "user", "content": "Generate a commit for added login.js"}
    ]
  }'

# Expected response:
# {"choices":[{"message":{"content":"feat(auth): add login functionality..."}}]}
```

### Try It Out

1. Make some code changes
2. Stage them: `git add .`
3. Open Command Palette: `Cmd/Ctrl + Shift + P`
4. Run: `JIRA Smart Commit: Commit Now`
5. The extension now uses your team gateway! 🎉

---

## Configuration Options

### Option 1: User Settings (Per Developer)

Each developer can configure their own gateway in VS Code settings:

```json
{
  "jiraSmartCommit.ai.enabled": true,
  "jiraSmartCommit.ai.provider": "team-gateway",
  "jiraSmartCommit.ai.baseUrl": "https://gateway.yourteam.com/v1",
  "jiraSmartCommit.ai.model": "team-default",
  "jiraSmartCommit.ai.teamGatewayRequiresAuth": false
}
```

### Option 2: Team Config (Shared Repository)

**Recommended for teams:** Create a `.jira-smart-commit.json` file in your repository root:

```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.yourteam.com/v1",
    "model": "gpt-5.1",
    "maxTokens": 512,
    "temperature": 1,
    "teamGatewayRequiresAuth": false,
    "systemPrompt": "Custom system prompt for your team",
    "userPromptTemplate": "Custom user prompt template with variables",
    "format": "conventional",
    "language": "en"
  },
  "pr": {
    "promptTemplate": "Custom PR description prompt template",
    "autoSubmit": false
  },
  "firstPrompt": {
    "autoSubmit": false,
    "taskTemplate": "Custom task/story template",
    "bugTemplate": "Custom bug template"
  },
  "enableConventionalCommits": true,
  "detectBreakingChanges": true,
  "scopeStrategy": "auto",
  "commitTemplate": "Custom commit message template"
}
```

**Available Settings:**

**AI Configuration:**
- `provider` - LLM provider (openai, anthropic, gemini, ollama, moonshot, team-gateway)
- `model` - Model name (e.g., gpt-5.1, claude-sonnet-4-5)
- `baseUrl` - Gateway or custom API endpoint URL
- `maxTokens` - Maximum tokens for completion
- `temperature` - Model temperature (0-2)
- `systemPrompt` - Custom system prompt for AI
- `userPromptTemplate` - Custom user prompt template with variables
- `format` - Output format (conventional, plain)
- `language` - Language for commit messages (en, id, etc.)
- `teamGatewayRequiresAuth` - Whether gateway requires authentication

**PR Description Templates:**
- `pr.promptTemplate` - Custom template for PR description generation
- `pr.autoSubmit` - Auto-submit to Copilot Chat

**First Prompt Templates:**
- `firstPrompt.autoSubmit` - Auto-submit to Copilot Chat
- `firstPrompt.taskTemplate` - Template for Task/Story issues
- `firstPrompt.bugTemplate` - Template for Bug/Defect issues

**General Settings:**
- `commitTemplate` - Custom commit message template
- `enableConventionalCommits` - Enforce Conventional Commits format
- `detectBreakingChanges` - Detect breaking changes in diffs
- `scopeStrategy` - How to detect scope (packageJson, folder, auto, none)
- `jiraKeyPosition` - Where to place JIRA key (footer, subject-prefix, subject-suffix)
- `fetchRelatedIssues` - Fetch related JIRA issues

**Benefits:**
- All team members automatically use the same gateway and templates
- Commit the file to version control for team-wide consistency
- Individual developers can still override in their settings if needed
- No sensitive information stored (API keys remain in VS Code SecretStorage)

## Gateway Requirements

Your team gateway must implement an **OpenAI-compatible API** with the following endpoint:

### Endpoint: `POST /chat/completions`

**Request Format:**
```json
{
  "model": "gpt-5.1",
  "max_tokens": 256,
  "temperature": 1,
  "messages": [
    { "role": "system", "content": "You are a commit message generator..." },
    { "role": "user", "content": "Generate a commit message for..." }
  ]
}
```

**Response Format (OpenAI-compatible):**
```json
{
  "choices": [
    {
      "message": {
        "content": "feat(auth): implement login feature\n\nAdds JWT-based authentication..."
      }
    }
  ]
}
```

**Alternative Response Formats (also supported):**
```json
{
  "content": [{ "text": "commit message here..." }]
}
```
or
```json
{
  "output": "commit message here..."
}
```

## Authentication Options`

### Option A: No Authentication (Gateway Handles It)

If your gateway handles authentication internally (e.g., via network ACLs, VPN, IP whitelist):

```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.internal.yourteam.com/v1",
    "teamGatewayRequiresAuth": false
  }
}
```

### Option B: User API Keys

If your gateway requires per-user authentication:

```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.yourteam.com/v1",
    "teamGatewayRequiresAuth": true
  }
}
```

When `teamGatewayRequiresAuth` is `true`:
1. Each developer will be prompted for an API key on first use
2. The key is stored securely in VS Code SecretStorage (Keychain)
3. The key is sent as: `Authorization: Bearer <api-key>`

## Example Gateway Implementations

### 1. Simple Node.js Proxy

```javascript
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

app.post('/chat/completions', async (req, res) => {
  try {
    // Forward to actual provider (with team API key)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Gateway running on port 3000'));
```

### 2. Cloudflare Worker Gateway

```javascript
export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.json();
    
    // Forward to OpenAI with team key
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    return new Response(await response.text(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### 3. With Caching & Rate Limiting

```javascript
const cache = new Map();

app.post('/chat/completions', async (req, res) => {
  const cacheKey = JSON.stringify(req.body);
  
  // Check cache
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  
  // Rate limiting per user
  const userId = req.headers['x-user-id'];
  if (!checkRateLimit(userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  // Forward request
  const response = await callProvider(req.body);
  
  // Cache response
  cache.set(cacheKey, response);
  
  res.json(response);
});
```

## Common Configurations

### Development (Local Gateway)

```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "http://localhost:3000",
    "model": "gpt-5.1",
    "teamGatewayRequiresAuth": false
  }
}
```

### Production (Authenticated Gateway)

```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.company.com/v1",
    "model": "gpt-5.1",
    "teamGatewayRequiresAuth": true
  }
}
```

When `teamGatewayRequiresAuth: true`, developers will be prompted for API key on first use.

### With Custom System Prompt

```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.yourteam.com/v1",
    "model": "gpt-5.1",
    "systemPrompt": "You are a senior engineer. Write commit messages in our team style: action verb + component + brief description."
  }
}
```

## Configuration Precedence

Settings are resolved in this order:

1. **User Settings** (VS Code settings.json) - Highest priority
2. **Team Config** (.jira-smart-commit.json in repo)
3. **Defaults** - Lowest priority

This allows:
- Teams to set defaults
- Individual developers to override when needed
- New team members to work immediately with team settings

---

## Production Deployment

### 1. Use HTTPS
```json
{
  "ai": {
    "baseUrl": "https://gateway.yourteam.com/v1"
  }
}
```

### 2. Add Health Monitoring
```bash
# Add to your monitoring system
curl https://gateway.yourteam.com/health

# Expected: {"status":"healthy","timestamp":"..."}
```

### 3. Set Up Rate Limiting
Implement rate limiting in your gateway to prevent abuse:
```javascript
const RATE_LIMIT = 500; // requests per hour
```

### 4. Enable Logging
Log all requests for monitoring:
```
[2025-11-22T10:30:00.000Z] Request from 192.168.1.5: { model: 'gpt-5.1', maxTokens: 256 }
[2025-11-22T10:30:01.000Z] Tokens used: { prompt: 45, completion: 120, total: 165 }
```

### 5. Deploy Behind Load Balancer
```
Client → Load Balancer → [Gateway1, Gateway2, Gateway3] → OpenAI
```

## Security Best Practices

✅ **DO:**
- Store gateway URL in team config (it's not sensitive)
- Keep API keys in VS Code SecretStorage (never in config files)
- Use HTTPS for gateway endpoints
- Implement rate limiting in your gateway
- Log usage for monitoring and debugging

❌ **DON'T:**
- Commit API keys to version control
- Store credentials in `.jira-smart-commit.json`
- Use HTTP (unencrypted) for production gateways
- Share individual API keys between developers

## Testing Your Gateway

Test your gateway with curl:

```bash
curl -X POST https://gateway.yourteam.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "model": "gpt-5.1",
    "max_tokens": 256,
    "temperature": 1,
    "messages": [
      {"role": "system", "content": "You are a commit message generator."},
      {"role": "user", "content": "Generate a commit for added login.js"}
    ]
  }'
```

Expected response:
```json
{
  "choices": [
    {
      "message": {
        "content": "feat(auth): add login functionality\n\nImplements user authentication with JWT tokens."
      }
    }
  ]
}
```

## Troubleshooting

### Gateway Returns 401
**Fix:** Set authentication in config:
```json
{
  "ai": {
    "teamGatewayRequiresAuth": true
  }
}
```
Then reset API key: `Command Palette > JIRA Smart Commit: Reset AI API Key`

### Connection Refused
**Check:**
1. Gateway is running: `curl http://localhost:3000/health`
2. Correct URL in config
3. Firewall/network allows connection

### Gateway Returns Empty Response
**Fix:** Ensure your gateway returns OpenAI-compatible format:
```json
{
  "choices": [
    {
      "message": {
        "content": "your commit message here"
      }
    }
  ]
}
```

### Error: "Team gateway requires baseUrl to be configured"

**Solution:** Add `baseUrl` to your config:
```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.yourteam.com/v1"
  }
}
```

### Error: "Team Gateway returned no content"

**Cause:** Gateway response format doesn't match expected format.

**Solution:** Ensure your gateway returns one of these formats:
- OpenAI format: `{ choices: [{ message: { content: "..." } }] }`
- Anthropic format: `{ content: [{ text: "..." }] }`
- Simple format: `{ output: "..." }` or `{ text: "..." }`

## Migration Guide

### From Individual Providers to Team Gateway

**Before:**
```json
// Each dev has their own config
{
  "jiraSmartCommit.ai.provider": "openai",
  "jiraSmartCommit.ai.model": "gpt-5.1"
}
```

**After:**
```json
// .jira-smart-commit.json (team config)
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.yourteam.com/v1",
    "model": "gpt-5.1"
  }
}
```

All developers automatically use the team gateway after committing this file.

---

## Next Steps

- Implement your own gateway using the example code above
- Add caching: Implement Redis caching for common requests
- Monitor usage: Parse gateway logs to analyze team AI usage
- Scale up: Deploy multiple gateway instances behind load balancer

## Support

For issues or questions:
1. Check that your gateway implements the OpenAI-compatible API
2. Test the gateway endpoint with curl: `curl http://your-gateway/health`
3. Check VS Code Developer Console for detailed error messages
4. Open an issue on GitHub with gateway response samples
