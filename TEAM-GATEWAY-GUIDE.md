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
  },
  "enableUsageTracking": true,
  "trackingUrl": "/api/tracking"
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
  },
  "enableUsageTracking": true,
  "trackingUrl": "/api/tracking"
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
  "commitTemplate": "Custom commit message template",
  "enableUsageTracking": true,
  "trackingUrl": "/api/tracking",
  "trackingRequiresAuth": false,
  "anonymizeUser": false
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

**Usage Tracking (Team Config Only):**
- `enableUsageTracking` - Enable usage analytics tracking (default: true)
- `trackingUrl` - Tracking endpoint URL (default: `/api/tracking`)
- `trackingRequiresAuth` - Whether tracking requires authentication (default: false)
- `anonymizeUser` - SHA-256 hash user emails for privacy (default: false)

See [Usage Tracking](#usage-tracking) section for detailed configuration.

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

## Usage Tracking

**⚠️ Requirement:** Usage tracking only works when `provider: "team-gateway"` is enabled.

The team gateway supports optional usage analytics tracking for all AI features:
- **Commit message generation** - Track AI-generated commits
- **PR descriptions** - Track PR generation usage (uses Copilot Chat but sends metadata to gateway)
- **First prompts** - Track JIRA-to-prompt conversions

### Why Track Usage?

- Monitor AI adoption across your team
- Track costs per feature, user, or repository
- Identify high-value use cases
- Plan capacity and rate limits
- Generate usage reports for management

### Configuration

Add tracking settings to `.jira-smart-commit.json` (team config only):

```json
{
  "ai": {
    "provider": "team-gateway",
    "baseUrl": "https://gateway.yourteam.com/v1",
    "model": "gpt-5.1"
  },
  "enableUsageTracking": true,
  "trackingUrl": "/api/tracking",
  "trackingRequiresAuth": false,
  "anonymizeUser": false
}
```

**Configuration Options:**

- `enableUsageTracking` (default: `true`) - Enable/disable tracking
- `trackingUrl` (default: `/api/tracking`) - Tracking endpoint (relative path or absolute URL)
- `trackingRequiresAuth` (default: `false`) - Whether tracking endpoint requires authentication
- `anonymizeUser` (default: `false`) - SHA-256 hash user emails for privacy

**URL Resolution:**

```json
// Relative path (resolved from baseUrl)
"trackingUrl": "/api/tracking"
// → https://gateway.yourteam.com/v1/api/tracking

// Absolute URL (use as-is)
"trackingUrl": "https://analytics.yourteam.com/track"
// → https://analytics.yourteam.com/track
```

### Tracking Endpoint Specification

Your gateway must implement: **`POST /api/tracking`**

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <api-key>          (if trackingRequiresAuth: true)
x-feature-type: commit|pr|firstPrompt
x-metadata-version: 1.0
x-user-email: user@example.com           (or SHA-256 hash if anonymized)
x-request-id: uuid-v4
x-timestamp: 2025-11-22T10:30:00.000Z
x-jira-key: ABC-123                      (optional)
x-repository: my-project                 (optional)
x-branch: feature/ABC-123-login          (optional)
```

**Request Body (Metadata Schema v1.0):**

All fields use **camelCase** format.

```json
{
  "metadataVersion": "1.0",
  "feature": "commit",
  "user": "user@example.com",
  "timestamp": "2025-11-22T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "jiraKey": "ABC-123",
  "repository": "my-project",
  "branch": "feature/ABC-123-login",
  
  // Feature-specific fields (optional)
  "commitsAnalyzed": 12,
  "filesChanged": 8,
  "language": "TypeScript",
  "coverageDetected": true,
  "issueType": "Task",
  "templateType": "task"
}
```

**Required Fields (All Features):**
- `metadataVersion` - Schema version (currently `"1.0"`)
- `feature` - Feature type: `"commit"`, `"pr"`, or `"firstPrompt"`
- `user` - User email or SHA-256 hash
- `timestamp` - ISO 8601 timestamp
- `requestId` - UUID v4

**Optional Fields (Common):**
- `jiraKey` - JIRA issue key
- `repository` - Repository name
- `branch` - Git branch name

**Optional Fields (Feature-Specific):**

**For `feature: "pr"`:**
- `commitsAnalyzed` - Number of commits analyzed
- `filesChanged` - Number of files changed
- `language` - Detected language (e.g., "TypeScript", "Go")
- `coverageDetected` - Boolean, whether test coverage was detected

**For `feature: "firstPrompt"`:**
- `issueType` - JIRA issue type (e.g., "Task", "Bug", "Story")
- `templateType` - Template used: `"task"` or `"bug"`

**Response:**
```json
{
  "success": true,
  "tracked": true
}
```

Gateway should accept any response status `2xx` as success. The extension sends fire-and-forget requests with 5-second timeout and fails silently on errors.

### Metadata Schema Versioning

**Current Version: 1.0**

- Gateway must accept multiple schema versions simultaneously
- New optional fields may be added to v1.0 without version bump
- Breaking changes will require v2.0
- Gateway should gracefully handle unknown optional fields

**Future Compatibility:**

```javascript
// Gateway should handle both v1.0 and future versions
app.post('/api/tracking', (req, res) => {
  const { metadataVersion, ...data } = req.body;
  
  switch (metadataVersion) {
    case '1.0':
      // Handle v1.0 schema
      break;
    case '2.0':
      // Handle v2.0 schema (future)
      break;
    default:
      // Unknown version - accept gracefully
      break;
  }
  
  res.json({ success: true, tracked: true });
});
```

### Privacy: User Anonymization

Enable `anonymizeUser: true` to hash emails with SHA-256:

```json
{
  "anonymizeUser": true
}
```

**Before anonymization:**
```
"user": "john.doe@company.com"
```

**After anonymization:**
```
"user": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
```

Benefits:
- Maintain per-user analytics without storing emails
- GDPR/privacy compliance
- Consistent hashing across team (no salt)

### Example Implementation (Node.js + PostgreSQL)

```javascript
const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json());

// Create table
const schema = `
CREATE TABLE IF NOT EXISTS usage_tracking (
  id SERIAL PRIMARY KEY,
  metadata_version VARCHAR(10) NOT NULL,
  feature VARCHAR(20) NOT NULL,
  user_hash VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  request_id UUID NOT NULL UNIQUE,
  jira_key VARCHAR(50),
  repository VARCHAR(255),
  branch VARCHAR(255),
  commits_analyzed INTEGER,
  files_changed INTEGER,
  language VARCHAR(50),
  coverage_detected BOOLEAN,
  issue_type VARCHAR(50),
  template_type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature ON usage_tracking(feature);
CREATE INDEX idx_user ON usage_tracking(user_hash);
CREATE INDEX idx_timestamp ON usage_tracking(timestamp);
CREATE INDEX idx_jira_key ON usage_tracking(jira_key);
`;

// Tracking endpoint
app.post('/api/tracking', async (req, res) => {
  try {
    const {
      metadataVersion,
      feature,
      user,
      timestamp,
      requestId,
      jiraKey,
      repository,
      branch,
      commitsAnalyzed,
      filesChanged,
      language,
      coverageDetected,
      issueType,
      templateType
    } = req.body;

    // Validate required fields
    if (!metadataVersion || !feature || !user || !timestamp || !requestId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert tracking data
    await pool.query(`
      INSERT INTO usage_tracking (
        metadata_version, feature, user_hash, timestamp, request_id,
        jira_key, repository, branch, commits_analyzed, files_changed,
        language, coverage_detected, issue_type, template_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (request_id) DO NOTHING
    `, [
      metadataVersion, feature, user, timestamp, requestId,
      jiraKey, repository, branch, commitsAnalyzed, filesChanged,
      language, coverageDetected, issueType, templateType
    ]);

    res.json({ success: true, tracked: true });
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics endpoint: Usage by feature
app.get('/api/analytics/by-feature', async (req, res) => {
  const result = await pool.query(`
    SELECT 
      feature,
      COUNT(*) as total_requests,
      COUNT(DISTINCT user_hash) as unique_users,
      COUNT(DISTINCT DATE(timestamp)) as active_days
    FROM usage_tracking
    WHERE timestamp > NOW() - INTERVAL '30 days'
    GROUP BY feature
    ORDER BY total_requests DESC
  `);
  res.json(result.rows);
});

// Analytics endpoint: Top users
app.get('/api/analytics/top-users', async (req, res) => {
  const result = await pool.query(`
    SELECT 
      user_hash,
      feature,
      COUNT(*) as request_count
    FROM usage_tracking
    WHERE timestamp > NOW() - INTERVAL '30 days'
    GROUP BY user_hash, feature
    ORDER BY request_count DESC
    LIMIT 10
  `);
  res.json(result.rows);
});

// Analytics endpoint: Usage over time
app.get('/api/analytics/timeline', async (req, res) => {
  const result = await pool.query(`
    SELECT 
      DATE(timestamp) as date,
      feature,
      COUNT(*) as requests
    FROM usage_tracking
    WHERE timestamp > NOW() - INTERVAL '90 days'
    GROUP BY DATE(timestamp), feature
    ORDER BY date DESC
  `);
  res.json(result.rows);
});

app.listen(3000, () => {
  console.log('Gateway with tracking running on port 3000');
});
```

### Analytics Dashboard Ideas

**Track and visualize:**

1. **Feature Adoption** - Which features are most used (commit vs PR vs first prompt)?
2. **User Activity** - Who's using AI most? Identify power users and laggards
3. **Repository Insights** - Which projects use AI most?
4. **Time Trends** - Usage patterns by hour/day/week
5. **JIRA Integration** - Which tickets get AI-generated content?
6. **Language Breakdown** - What programming languages benefit most from AI?
7. **Coverage Correlation** - Do PRs with test coverage get better descriptions?

**Sample Queries:**

```sql
-- Daily active users
SELECT DATE(timestamp), COUNT(DISTINCT user_hash) as dau
FROM usage_tracking
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp);

-- Most active repositories
SELECT repository, COUNT(*) as usage_count
FROM usage_tracking
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND repository IS NOT NULL
GROUP BY repository
ORDER BY usage_count DESC
LIMIT 10;

-- PR generation with coverage
SELECT 
  coverage_detected,
  COUNT(*) as pr_count,
  AVG(commits_analyzed) as avg_commits,
  AVG(files_changed) as avg_files
FROM usage_tracking
WHERE feature = 'pr'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY coverage_detected;
```

### Disabling Tracking

To disable tracking:

```json
{
  "enableUsageTracking": false
}
```

Or remove tracking configuration entirely - it defaults to enabled but will fail silently if team gateway is not configured.

### Testing Your Tracking Endpoint

```bash
# Test tracking endpoint
curl -X POST https://gateway.yourteam.com/api/tracking \
  -H "Content-Type: application/json" \
  -H "x-feature-type: commit" \
  -H "x-metadata-version: 1.0" \
  -H "x-user-email: test@example.com" \
  -H "x-request-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-timestamp: 2025-11-22T10:30:00.000Z" \
  -d '{
    "metadataVersion": "1.0",
    "feature": "commit",
    "user": "test@example.com",
    "timestamp": "2025-11-22T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "jiraKey": "TEST-123",
    "repository": "my-project",
    "branch": "feature/test"
  }'

# Expected response:
# {"success":true,"tracked":true}
```

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
