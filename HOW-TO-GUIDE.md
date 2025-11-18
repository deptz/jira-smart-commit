# JIRA Smart Commit - How To Guide

## Basic Setup

Before running the Smart Commit, make sure you've configured the extension correctly.

| Setting | Description | Example |
|---------|-------------|---------|
| **Base URL** | Set your JIRA base URL | `https://your-company.atlassian.net` |
| **Email** | Use your JIRA account email | `your.name@company.com` |
| **JIRA Key Position** | Set to subject-prefix so that the commit subject includes the JIRA key | ✅ subject-prefix |
| **Jira API Token** | Your JIRA API token can be generated from Atlassian Account Settings → API Tokens. You will be prompted when first time using this extension. | `ATATT3xFfGF0P…..` |

## Enabling AI (Recommended)



If you want to enhance your commits with AI suggestions, enable these options:

| Setting | Description | Example |
|---------|-------------|---------|
| **AI: Enabled** | Check this to enable AI support | ☑️ |
| **AI: Model** | Choose your preferred LLM model | e.g., `gpt-5`, `claude-sonnet-4-5`, `gemini-2.5-pro` |
| **AI: Provider** | Select the provider that matches the model | e.g., OpenAI, Anthropic, Google, Moonshot |
| **AI: Temperature** | Set the temperature configuration. | ⚠️ Note: Only for OpenAI GPT-5, must be set to 1.0|
| **AI: Max Tokens** | Defines how much context (tokens) the AI can use to analyze your commit. Set this higher to include more context, including file diffs, for better AI suggestions. | e.g. 1000 or higher |

## 🪄 How to Run a JIRA Smart Commit

Before running, ensure you're on the correct branch and have your changes ready:

### 1. Check Out the Correct Branch
Make sure you are on a Git branch that includes the JIRA key in its name.

**Example:** `feature/TF-123-add-customer-summary`

### 2. Stage Your Changes
Stage one or more files that you want to include in the commit.

You can do this from the Source Control panel or via `git add <file>`.

### 3. Open the Command Palette
Navigate to **View → Command Palette** or press **Shift + Cmd + P** (on macOS).

### 4. Run the Smart Commit Command
Type **JIRA Smart Commit**, then select **Commit Now**.

### 5. Enter Tokens (First Time Only)
- You will be prompted for your **JIRA API Token**.
- If AI is enabled, you'll also be prompted for your **AI Provider Token**.
- These are securely stored for future runs.

### 6. Edit or Confirm the Commit Message
- The commit window will pop up.
- You can edit the message in the VS Code Git input box, or simply commit directly.

## 🔧 Advanced Features

### Multi-Repository Support
If you're working with multiple Git repositories (monorepos):

1. **Repository Auto-Detection**: The extension automatically detects which repository you're working in based on your active file
2. **Repository Picker**: When multiple repos are detected, you'll see a picker to select the target repository
3. **Status Bar**: Shows current JIRA key and repository: `JIRA: ABC-123 (repo-name)`

### PR Description Generator
Generate comprehensive, reviewer-ready pull request descriptions using GitHub Copilot Chat:

#### Quick Start

1. **Sync your branch** (Important!):
   ```bash
   git fetch origin
   git pull --ff-only  # or merge/rebase as appropriate
   ```
   The default prompt will refuse to generate if your branch is behind origin.

2. **Run the command**: **JIRA Smart Commit: Generate PR Description**

3. **Wait for analysis**:
   - Extracts JIRA key from branch name
   - Analyzes Git commits and file changes
   - Fetches JIRA issue details
   - Detects project language and test coverage
   - Builds comprehensive context

4. **Review in Copilot Chat**:
   - Description is automatically sent to GitHub Copilot Chat
   - Review the generated content

5. **Copy and paste**:
   - Copy from Copilot Chat (Cmd+C / Ctrl+C)
   - Paste into your PR on GitHub/GitLab/Bitbucket/Azure DevOps

#### What You Get

The default prompt generates structured sections:
- **Summary** - 2-3 sentence overview with JIRA reference
- **What Changed** - Organized by category (backend, API, frontend, tests, infra, config, docs)
- **Testing** - Clear steps, preconditions, expected results
- **Impact & Risks** - Systems affected, breaking changes, performance/security implications
- **Additional Notes** - Dependencies, config changes, deployment considerations
- **Missing Context** - Gaps in information that need clarification

#### Default Prompt Behavior

The extension uses a **Staff Engineer-grade prompt** that:
- ✅ **Blocks if branch is behind origin** - Ensures complete context
- ✅ **Evidence-based only** - No speculation, only facts from diffs
- ✅ **Precise technical language** - File paths, components, endpoints
- ✅ **Proactive risk highlighting** - Breaking changes, migrations, side effects
- ✅ **Explicit about gaps** - Flags missing or unclear information

#### Configuration Options

```json
{
  "jiraSmartCommit.pr.enabled": true,
  "jiraSmartCommit.pr.autoSubmit": false,  // false = paste for review, true = auto-submit
  "jiraSmartCommit.pr.promptTemplate": "Your custom template with {{CONTEXT}} placeholder"
}
```

#### Customizing the Prompt Template

To customize:
1. Open Settings → Search for `jiraSmartCommit.pr.promptTemplate`
2. Edit the template
3. Use `{{CONTEXT}}` placeholder where commit/JIRA/coverage data should be inserted
4. Include your own sections, rules, or output format

### Git Hooks Integration (Optional)
Automate commit message generation with Git hooks:

1. Run command: **JIRA Smart Commit: Setup Git Hooks**
2. This installs a `prepare-commit-msg` hook that automatically generates JIRA-compliant commit messages
3. Every commit will now use smart commit messages without manual intervention

## 📝 Configuration Examples

### Basic Configuration
````json
{
  "jiraSmartCommit.jira.baseUrl": "https://your-company.atlassian.net",
  "jiraSmartCommit.jira.email": "your.email@company.com",
  "jiraSmartCommit.commitMessage.jiraKeyPosition": "subject-prefix"
}
````

### AI-Enhanced Configuration
````json
{
  "jiraSmartCommit.ai.enabled": true,
  "jiraSmartCommit.ai.provider": "anthropic",
  "jiraSmartCommit.ai.model": "claude-haiku-4-5",
  "jiraSmartCommit.ai.maxTokens": 2000,
  "jiraSmartCommit.ai.temperature": 0.7
}
````

### Multi-Repository Configuration
````json
{
  "jiraSmartCommit.repository.multiRepoSupport": true,
  "jiraSmartCommit.repository.showRepoInStatusBar": true
}
````

## 🚨 Troubleshooting

### Common Issues

#### "No JIRA key found in branch name"
- **Solution**: Ensure your branch name contains a JIRA key (e.g., `ABC-123`)
- **Supported formats**: 
  - `feature/ABC-123-description`
  - `ABC-123-fix-bug`
  - `username/ABC-123`

#### "JIRA API authentication failed"
- **Solution**: 
  1. Generate a new API token from [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
  2. Run command: **JIRA Smart Commit: Reset JIRA Credentials**
  3. Enter the new token when prompted

#### "Git repository not found"
- **Solution**: 
  1. Ensure you're in a Git repository
  2. Install the Git extension for VS Code
  3. Open a folder that contains a `.git` directory

#### Windows Command Issues
- **Fixed in v0.3.2**: All shell escaping issues resolved
- If you still experience issues, ensure you're using the latest version

### Performance Tips

1. **Reduce AI Token Usage**: Lower `maxTokens` setting for faster commit message responses
2. **Use Local AI**: Configure Ollama for offline AI processing for commits
3. **Disable AI for Simple Commits**: Only enable AI for complex commit message generation
4. **Sync before PR generation**: Always fetch and pull latest changes before generating PR descriptions

## 💡 Tips & Best Practices

### Branch Naming
Use descriptive branch names with JIRA keys:
- ✅ `feature/TF-123-implement-user-dashboard`
- ✅ `bugfix/TF-456-fix-login-error`
- ❌ `my-feature-branch`

### Staging Changes
Stage related changes together for better commit messages:
- ✅ Stage all files related to one feature
- ❌ Don't stage unrelated changes

### AI Usage for Commits
- **Complex Changes**: Enable AI for multi-file changes or refactoring
- **Simple Changes**: Disable AI for typo fixes or minor updates
- **Review AI Suggestions**: Always review generated commit messages before committing

### PR Description Generation
- **Uses GitHub Copilot**: PR descriptions are generated using GitHub Copilot Chat (not configurable AI providers)
- **Sync first**: Always run `git fetch && git pull` before generating PR descriptions
- **Review output**: Check GitHub Copilot's generated description for accuracy
- **Customize template**: Adjust the prompt template to match your team's standards

### Multi-Repository Workflows
- Keep JIRA keys consistent across repositories
- Use the repository picker to ensure commits go to the right project
- Monitor the status bar to confirm you're in the correct repository

## 🔐 Security Notes

- **API Tokens**: Stored securely in VS Code's secret storage
- **No Data Sharing**: All processing happens locally or directly with your configured services
- **Shell Safety**: All git commands are properly escaped to prevent injection attacks

## 📞 Support

If you encounter issues:

1. Check the **Output** panel in VS Code for detailed error messages
2. Ensure all dependencies (Git extension) are installed
3. Verify your JIRA credentials and permissions
4. For commit AI issues, check your provider's API status and quotas

Your JIRA API token can be generated from [Atlassian Account Settings → API Tokens](https://id.atlassian.com/manage/api-tokens).