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
| **AI: Provider** | Select the provider that matches the model | e.g., OpenAI, Anthropic, Google |
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
Generate comprehensive pull request descriptions:

1. Run command: **JIRA Smart Commit: Generate PR Description**
2. The extension will:
   - Extract JIRA key from your branch name
   - Analyze your Git commits and changes
   - Fetch JIRA issue details
   - Generate structured PR description with 5 sections:
     - Summary
     - What Changed
     - Testing
     - Impact & Risks
     - Additional Notes

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
  "jiraSmartCommit.ai.model": "claude-3-haiku-20240307",
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

1. **Reduce AI Token Usage**: Lower `maxTokens` setting for faster responses
2. **Use Local AI**: Configure Ollama for offline AI processing
3. **Disable AI for Simple Commits**: Only enable AI for complex changes

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

### AI Usage
- **Complex Changes**: Enable AI for multi-file changes or refactoring
- **Simple Changes**: Disable AI for typo fixes or minor updates
- **Review AI Suggestions**: Always review generated messages before committing

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
4. For AI issues, check your provider's API status and quotas

Your JIRA API token can be generated from [Atlassian Account Settings → API Tokens](https://id.atlassian.com/manage/api-tokens).

AI suggestions work best when the context is clear — ensure your commit includes a valid ticket reference and descriptive changes.