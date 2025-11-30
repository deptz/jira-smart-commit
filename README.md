# JIRA Smart Commit (VS Code Extension)

**Automate your engineering workflow with JIRA context and AI.**

Generate high-quality **Conventional Commits**, structured **PR Descriptions**, and optimized **Copilot Prompts** directly from your JIRA tickets and staged changes.

---

## 🚀 Quick Start

Follow the full engineering lifecycle: **Plan → Develop → Review**.

### 1. Plan: Generate First Prompt
*Transform a JIRA ticket into a structured prompt for GitHub Copilot to kickstart your development.*

1.  Checkout a branch with a JIRA key (e.g., `feature/PROJ-123-user-login`).
2.  Run command: **`JIRA Smart Commit: Generate First Prompt`**.
3.  The extension fetches the ticket details and creates a context-rich prompt.
4.  **Result**: The prompt is sent to GitHub Copilot Chat (auto-submitted or pasted) to help you plan the implementation.

### 2. Develop: Smart Commit
*Generate a Conventional Commit message based on your staged changes and JIRA context.*

1.  Stage your changes (`git add ...`).
2.  Run command: **`JIRA Smart Commit: Commit Now`**.
3.  Review the generated message in the preview dialog.
4.  **Result**: A perfect commit message linked to your JIRA ticket.
    ```text
    feat(auth): implement login page
    
    Adds the login form with validation and error handling.
    
    Refs: PROJ-123
    ```

### 3. Review: PR Description
*Create a comprehensive Pull Request description ready for review.*

1.  Run command: **`JIRA Smart Commit: Generate PR Description`**.
2.  The extension analyzes all commits, file changes, and the JIRA ticket.
3.  **Result**: A structured PR description is generated in GitHub Copilot Chat, ready to copy-paste into GitHub/GitLab/Bitbucket.

### 4. Quality: Enforce Test Coverage
*Ensure ≥90% test coverage on all changed code.*

1.  Run command: **`JIRA Smart Commit: Enforce Test Coverage`**.
2.  GitHub Copilot automatically detects all changes (last commit + staged + unstaged).
3.  **Result**: A comprehensive test coverage analysis and enforcement plan is generated in Copilot Chat, ensuring all changed lines and branches are covered.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🤖 AI-Powered Commits** | Uses OpenAI (GPT-5.1, Codex), Anthropic (Claude), Gemini (Pro), or Ollama to write commit messages. |
| **📝 Conventional Commits** | Strictly enforces the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) standard. |
| **🔗 JIRA Integration** | Fetches summary, description, and acceptance criteria to provide context to the AI. |
| **💬 Copilot Integration** | Generates optimized prompts for GitHub Copilot Chat for planning, PRs, security, and test coverage. |
| **🧪 Test Coverage Enforcement** | Ensures ≥90% test coverage on all changed code with multi-language support (Go, Ruby, JS/TS, PHP, Python). |
| **🔒 Security Review** | Analyzes all commits for security vulnerabilities using OWASP Top 10 and additional categories. |
| **🏢 Team Config** | Share settings via `.jira-smart-commit.json` and enforce rules with pre-commit hooks. |
| **🔐 Secure** | API keys are stored in **VS Code SecretStorage** (Keychain), never in plain text. |
| **📂 Multi-Repo** | Seamlessly supports monorepos and multi-root workspaces. |

---

## ⚙️ Configuration

### Core Settings
*   `jiraSmartCommit.jiraKeyPosition`: Where to place the JIRA key (`footer` | `subject-prefix` | `subject-suffix`). Default: `footer`.
*   `jiraSmartCommit.scopeStrategy`: How to detect commit scope (`packageJson` | `folder` | `auto`).
*   `jiraSmartCommit.fetchRelatedIssues`: Fetch subtasks and parent issues for more context.

### AI Settings
*   `jiraSmartCommit.ai.enabled`: Enable AI post-processing (Default: `false`).
*   `jiraSmartCommit.ai.provider`: Choose `openai`, `anthropic`, `gemini`, `ollama`, `azure-openai`, `moonshot`, or `team-gateway`.
*   `jiraSmartCommit.ai.model`: Select your model (e.g., `gpt-5.1`, `claude-4-5-sonnet`, `gemini-3-pro-preview`, `gpt-5.1-codex`).
*   `jiraSmartCommit.ai.baseUrl`: Custom endpoint URL (for proxies, Ollama, or Team Gateway).

### Team Collaboration
*   **Repository Config**: Create a `.jira-smart-commit.json` in your root to share settings (templates, rules) with your team.
*   **Team Gateway**: Use a centralized LLM gateway for cost tracking and consistent configuration. See [TEAM-GATEWAY-GUIDE.md](./TEAM-GATEWAY-GUIDE.md) for setup.
*   **Usage Tracking**: Monitor team usage of commit generation, PR descriptions, and first prompts with optional metadata collection (opt-in with team gateway).
*   **Pre-commit Hook**: Run **`JIRA Smart Commit: Install Pre-commit Hook`** to enforce commit standards locally.

### Security Review
*   **Security Analysis**: Use **`JIRA Smart Commit: Review Security`** to analyze all commits on your current branch for security vulnerabilities.
*   **Configuration**: `jiraSmartCommit.security.enabled` - Enable/disable security review feature.
*   **Behavior**: Security review analyzes ALL commits on the current branch (no limit, no base branch comparison needed).
*   **Integration**: Uses GitHub Copilot Chat for security analysis. Requires GitHub Copilot to be installed and active.

### Test Coverage Enforcement
*   **Test Coverage Analysis**: Use **`JIRA Smart Commit: Enforce Test Coverage`** to ensure ≥90% test coverage on all changed code.
*   **Configuration**: `jiraSmartCommit.testCoverage.enabled` - Enable/disable test coverage enforcement feature.
*   **Multi-Language Support**: Automatically detects and supports Go, Ruby, JavaScript/TypeScript, PHP, and Python.
*   **Automatic Detection**: Infers language, test framework, coverage tools, and base branch automatically.
*   **Integration**: Uses GitHub Copilot Chat for test coverage analysis. Requires GitHub Copilot to be installed and active.
*   **Customizable**: Configure prompt template via `jiraSmartCommit.testCoverage.promptTemplate` or team config.

---

## 🌍 Supported Languages

The extension intelligently detects project structure to infer **scopes** and **types**:

| Language | Scope Detection | Example |
| :--- | :--- | :--- |
| **TypeScript/JS** | `package.json` name | `feat(ui): add button` |
| **Go** | `go.mod` module | `fix(api): handle error` |
| **Rails** | Models/Controllers | `feat(user): add model` |
| **Clean Arch** | Domain/Usecase layers | `feat(auth): login usecase` |
| **Generic** | Folder name | `docs(readme): update usage` |

---

## 🚀 Advanced Usage

### Token Allocation Strategy
Control how the AI uses its token budget for commit messages:
*   `balanced` (Default): 40% description, 60% diff.
*   `prefer-description`: 70% description (good for complex logic).
*   `prefer-diff`: 70% diff (good for large refactors).

### Commit History Context
The extension can include previous commits for the same ticket in the prompt. This helps the AI understand the *progression* of work and avoid repeating information.
*   `jiraSmartCommit.includeCommitHistory`: `true`
*   `jiraSmartCommit.commitHistoryLimit`: `5`

---

## 📦 Installation & Setup

1.  **Install** the extension from the VS Code Marketplace.
2.  **Configure JIRA**:
    *   Set `jiraSmartCommit.baseUrl` (e.g., `https://company.atlassian.net`).
    *   Set `jiraSmartCommit.email`.
    *   Enter your JIRA API Token when prompted.
3.  **(Optional) Configure AI**:
    *   Enable AI in settings.
    *   Choose your provider and enter the API Key.

For a detailed guide, see [HOW-TO-GUIDE.md](./HOW-TO-GUIDE.md).

---

## 📝 License

MIT © [triwibowo](https://github.com/deptz)
