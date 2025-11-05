
# JIRA Smart Commit (VS Code Extension)

Generate high-quality, Conventional Commit messages from **staged Git changes** and **JIRA tickets** (summary, description, acceptance criteria, relations). Optionally **polish with AI** while keeping credentials secure via **VS Code SecretStorage**.

## 📝 Conventional Commits 1.0.0

This extension follows the **[Conventional Commits 1.0.0](https://www.conventionalcommits.org/)** specification exactly.

### Message Structure

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Required Elements

1. **Type** (required): MUST be one of:
   - `feat`: A new feature
   - `fix`: A bug fix
   - `docs`: Documentation only changes
   - `style`: Code style changes (formatting, semicolons, etc.)
   - `refactor`: Code change that neither fixes a bug nor adds a feature
   - `perf`: Performance improvement
   - `test`: Adding or updating tests
   - `build`: Changes to build system or dependencies
   - `ci`: CI/CD configuration changes
   - `chore`: Other changes that don't modify src or test files

2. **Scope** (optional): A noun in parentheses describing the codebase section
   - Example: `feat(parser):`, `fix(auth):`, `refactor(api):`
   - **Smart auto-detection** from changed files, `package.json`, `go.mod`, or folder name
   - Uses specific component/module names when possible (e.g., `api`, `user`, `auth`)
   - Falls back to project name for simple projects

3. **Description** (required): Short summary in imperative mood
   - ✅ "add user authentication"
   - ❌ "added user authentication"
   - ❌ "adds user authentication"

4. **Footer** (optional): Metadata after a blank line
   - Format: `Token: value` or `Token #value`
   - Common tokens: `Refs`, `Reviewed-by`, `Closes`, `Fixes`
   - Example: `Refs: JIRA-123, JIRA-124`

### Supported Commit Types

The extension **automatically detects** the appropriate type based on changed files:

| Type | Description | Auto-Detected When | Example |
|------|-------------|-------------------|---------|
| **feat** | New feature | New files added to source dirs, migrations | `feat(auth): add OAuth2 login` |
| **fix** | Bug fix | Existing source files modified | `fix(api): resolve null pointer error` |
| **docs** | Documentation | `.md`, `.rdoc` files changed | `docs: update API documentation` |
| **style** | Code style/formatting | *(Manual selection)* | `style: fix indentation` |
| **refactor** | Code restructuring | Source files deleted | `refactor(db): simplify query builder` |
| **perf** | Performance improvement | *(Manual selection)* | `perf(parser): optimize regex matching` |
| **test** | Tests only | Only test files changed | `test: add user service tests` |
| **build** | Build system/dependencies | `package.json`, `go.mod`, `Gemfile`, etc. | `build: upgrade dependencies` |
| **ci** | CI/CD configuration | `.github/workflows`, CI config files | `ci: add automated tests` |
| **chore** | Maintenance tasks | Config files, scripts, other files | `chore: update eslint config` |

### Type Detection Examples

**Golang:**
```bash
# Add new Go file → feat
$ git add cmd/api/handler.go
→ feat(api): add health check handler

# Modify existing Go file → fix
$ git add pkg/user/service.go
→ fix(user): correct validation logic

# Only test files → test
$ git add internal/auth/handler_test.go
→ test: add authentication handler tests

# Update go.mod → build
$ git add go.mod go.sum
→ build: update dependencies
```

**Ruby on Rails:**
```bash
# Add migration → feat
$ git add db/migrate/20231013_create_users.rb
→ feat: add users table migration

# Modify model → fix
$ git add app/models/user.rb
→ fix(user): resolve validation issue

# Add spec → test
$ git add spec/models/user_spec.rb
→ test: add user model specs

# Update Gemfile → build
$ git add Gemfile Gemfile.lock
→ build: update rails to 7.1
```

**JavaScript/TypeScript:**
```bash
# Add new feature → feat
$ git add src/components/LoginForm.tsx
→ feat(auth): add login form component

# Fix existing component → fix
$ git add src/utils/validation.ts
→ fix(validation): handle edge cases

# Update tests → test
$ git add src/components/__tests__/LoginForm.test.tsx
→ test: add login form tests

# Update package.json → build
$ git add package.json package-lock.json
→ build: update react to v18
```

## 🌍 Supported Languages & Frameworks

The extension intelligently detects project structure and generates appropriate commit messages:

| Language/Framework | Supported Patterns | Scope Detection | Type Detection |
|-------------------|-------------------|-----------------|----------------|
| **JavaScript/TypeScript** | `src/`, `lib/`, `app/` | `package.json` name | ✅ |
| **Golang** | `cmd/`, `pkg/`, `internal/`, `*_test.go` | `go.mod` module or auto | ✅ |
| **Ruby on Rails** | `app/models/`, `app/controllers/`, `db/migrate/` | Auto from files | ✅ |
| **Python** | `src/`, `tests/`, `*_test.py` | Folder name | ✅ |
| **Clean Architecture** | `domain/`, `usecase/`, `infrastructure/` | Auto from layers | ✅ |
| **Java/Kotlin** | `src/main/`, `src/test/` | Folder name | ✅ |
| **Generic** | Any structure | Folder name | ✅ |

### Clean Architecture Detection

For projects following Clean Architecture, the extension detects the layer from file paths:

```bash
$ git add domain/user/entity.go
→ feat(user): add user entity

$ git add usecase/auth/login.go
→ feat(auth): implement login use case

$ git add infrastructure/repository/user_repo.go
→ feat(user): add user repository implementation
```


## ✨ Features

### Commit Message Generation
- Detect JIRA key from branch name (configurable regex) or prompt
- Fetch JIRA issue (summary, description, subtasks/links/parent)
- Analyze staged changes to infer type/scope and produce concise bullets
- Composable commit template and **AI post-processing** (OpenAI, Anthropic, Gemini, Ollama)
- Status Bar integration and one-click `Generate → Preview → Commit` flow
- Offline fallback if JIRA is unreachable (uses diff-only)
- **Multi-root workspace support** - works seamlessly with monorepos and multiple Git projects

### PR Description Generation (NEW in v0.3.0) 🚀
- **5 mandatory sections** with quality scoring (0-100 points, A-F grades)
- **AI enhancement** with 3 levels (minimal/balanced/detailed)
- **Multi-platform support** (Bitbucket, GitHub, GitLab)
- **Smart analysis** (language detection, coverage detection, commit parsing)
- **JIRA integration** (auto-extracts acceptance criteria, issue context)
- **Quality validation** with improvement suggestions
- **Platform-specific formatting** with PR title suggestions
- **Multi-root workspace support** - select repository when working with multiple projects

### Multi-Root Workspace Support
Working with **monorepos** or **multiple Git repositories** in one VS Code window? No problem!

#### Automatic Repository Detection
- **Smart detection**: Automatically detects the repository based on your active file
- **Repository picker**: When ambiguous, shows a quick picker to select the target repository
- **Status bar indicator**: Displays current repository name alongside JIRA key: `JIRA: ABC-123 (backend)`
- **Dynamic updates**: Status bar automatically updates when switching between files in different repos

#### How It Works
1. **Single Repository**: Works exactly as before, no changes needed
2. **Multiple Repositories**:
   - Opens a repository picker when you run any command
   - Automatically selects the repo containing your active file
   - Shows repository name in parentheses in the status bar
   - Seamlessly handles PR generation, commit message generation, etc.

#### Example Usage
```bash
# Monorepo structure
workspace/
├── backend/          # Git repo 1
│   └── .git
├── frontend/         # Git repo 2
│   └── .git
└── mobile/           # Git repo 3
    └── .git
```

When you:
- Open a file in `backend/` → Extension works with `backend` repo
- Run commit generation → Picker shows: `backend`, `frontend`, `mobile`
- Switch to `frontend/` file → Status bar updates to show `frontend` repo
- Generate PR description → Uses the selected repository's Git history

### Security & Reliability
- **SecretStorage** for API keys — no plaintext in settings
- **Graceful fallback** - works without AI or JIRA
- **Multi-level error handling** ensures generation always succeeds
- **User-friendly errors** with actionable guidance

## 🧩 Folder Structure
```
jira-smart-commit/
├─ src/
│  ├─ extension.ts
│  ├─ jiraClient.ts
│  ├─ diffAnalyzer.ts
│  ├─ template.ts
│  ├─ types.ts
│  ├─ utils.ts
│  ├─ aiKeyManager.ts
│  ├─ ai/
│  │  ├─ aiProvider.ts
│  │  ├─ index.ts
│  │  ├─ openaiProvider.ts
│  │  ├─ anthropicProvider.ts
│  │  ├─ geminiProvider.ts
│  │  └─ ollamaProvider.ts
│  ├─ pr/                         # NEW: PR Description Generator
│  │  ├─ commitAnalyzer.ts       # Analyze conventional commits
│  │  ├─ sectionGenerator.ts     # Generate 5 mandatory sections
│  │  ├─ scoreCalculator.ts      # Quality scoring (0-100)
│  │  ├─ prValidator.ts          # Validation & quality checks
│  │  ├─ prFormatter.ts          # Multi-platform formatting
│  │  ├─ prGenerator.ts          # Main orchestrator
│  │  ├─ aiPREnhancer.ts         # AI enhancement integration
│  │  ├─ languageDetector.ts     # Language/framework detection
│  │  ├─ coverageDetector.ts     # Test coverage analysis
│  │  └─ jiraExtractor.ts        # JIRA data extraction
│  └─ commands/
│     └─ generatePRDescription.ts # PR command handler
├─ media/preview.css
├─ package.json
├─ tsconfig.json
├─ .vscodeignore
├─ README.md
├─ CHANGELOG.md
└─ test/
   └─ fixtures/
```

## 🚀 Getting Started

📖 **[Complete How-To Guide](./HOW-TO-GUIDE.md)** - Detailed setup and usage instructions

1. **Install deps**
   ```bash
   npm i
   ```

2. **Configure JIRA**
   - Open Settings → search `JIRA Smart Commit` and set:
     - `jiraSmartCommit.baseUrl` = `https://your-domain.atlassian.net`
     - `jiraSmartCommit.email`   = `you@company.com` (used with API token)
   - On first JIRA call, you'll be prompted for **JIRA API token** → stored in SecretStorage.

3. **(Optional) Enable AI**
   - Set:
     - `jiraSmartCommit.ai.enabled = true`
     - `jiraSmartCommit.ai.provider = openai | anthropic | gemini | ollama | azure-openai`
     - `jiraSmartCommit.ai.model = gpt-4o-mini` (for OpenAI) or respective model/deployment
   - On first AI call, you'll be prompted for the provider API key → stored securely.

4. **Use the extension**
   - Stage your changes in Git (`git add` or use VS Code Source Control)
   - Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
   - Run one of these commands:
   
   **For Commit Messages:**
     - `JIRA Smart Commit: Generate` — Preview the commit message in editor
     - `JIRA Smart Commit: Insert into Git Input` — Insert into SCM input box
     - `JIRA Smart Commit: Commit Now` — Generate with preview dialog, then commit
   
   **For PR Descriptions:** 🆕
     - `JIRA Smart Commit: Generate PR Description` — Generate comprehensive PR description

**Commit Now Workflow:**
1. Run "JIRA Smart Commit: Commit Now"
2. Review the message in a modal dialog
3. Choose your action:
   - **Commit Now** — Proceed with commit immediately
   - **Edit in Git Input** — Insert to Git box for manual editing
   - **Cancel** — Abort the operation

**Tip:** You can also access commands via:
- Status bar item (bottom left) — Click the "JIRA: KEY-123" button
- Command Palette (`Cmd+Shift+P`) — Type "JIRA Smart Commit"

## ⚙️ Settings Reference (highlights)

### Core Settings

- `jiraSmartCommit.branchPattern` — default `(?<key>[A-Z][A-Z0-9]+-\d+)`
- `jiraSmartCommit.enableConventionalCommits` — Enable Conventional Commits format (default: `true`)
- `jiraSmartCommit.scopeStrategy` — `packageJson | folder | auto | none`
  - `packageJson`: Use package.json/go.mod name (default)
  - `folder`: Use workspace folder name
  - `auto`: **NEW!** Try to detect from changed file paths first, then fall back to package name
  - `none`: No scope
- `jiraSmartCommit.commitTemplate` — override message format (see variables below)

### JIRA Integration

- `jiraSmartCommit.jiraKeyPosition` — `footer | subject-prefix | subject-suffix` (default: `footer`)
  - `footer`: Adds `Refs: JIRA-123` at the bottom (recommended, follows Conventional Commits)
  - `subject-prefix`: Adds `JIRA-123 feat(scope): message`
  - `subject-suffix`: Adds `feat(scope): message [JIRA-123]`
- `jiraSmartCommit.fetchRelatedIssues` — **NEW!** Fetch related JIRA issues (subtasks, links, parent) (default: `false`)
  - When `false`: Only fetches basic issue info (faster, cleaner)
  - When `true`: Fetches full issue details including related issues
- `jiraSmartCommit.includeJiraDetailsInBody` — **NEW!** Include JIRA description and acceptance criteria in commit body (default: `false`)
  - When `false`: Generates clean, concise commits based on code changes only
  - When `true`: Includes full JIRA context in the commit message
- `jiraSmartCommit.relatedIssuesInFooter` — Include related issues in footer (default: `true`)
  - Requires `fetchRelatedIssues: true` to work
- `jiraSmartCommit.descriptionMaxLength` — Max chars for JIRA description (0 = unlimited)
- `jiraSmartCommit.smartTruncation` — Truncate at paragraph/sentence boundaries (default: `true`)
- `jiraSmartCommit.tokenAllocationStrategy` — `balanced | prefer-description | prefer-diff`
- `jiraSmartCommit.includeCommitHistory` — Include previous commits for same JIRA ticket (default: `true`)
- `jiraSmartCommit.commitHistoryLimit` — Max previous commits to include (default: `5`, max: `10`)

### AI Settings

- `jiraSmartCommit.ai.enabled` — Enable AI post-processing (default: `false`)
- `jiraSmartCommit.ai.provider` — `openai | anthropic | gemini | ollama | azure-openai`
- `jiraSmartCommit.ai.model` — Model name (e.g., `gpt-4o-mini`, `claude-3-5-sonnet-20241022`)
- `jiraSmartCommit.ai.*` — Additional provider/model/prompts/temperature settings

**Template Variables**
```
${type} ${scope} ${jira.summary} ${jira.oneLineDescription}
${jira.acceptanceBullets} ${changes.bullets}
```

**Note:** JIRA key and related issues are now **hardcoded** in the commit message footer to prevent AI hallucination. The AI no longer generates the `Refs:` footer—it's added automatically based on your `jiraKeyPosition` setting.

## 🔐 Secret Storage (recommended)
API keys and tokens are saved via **VS Code SecretStorage**, backed by the OS keychain (Keychain/Credential Manager/GNOME Keyring). They are **encrypted at rest**, **not synced**, and **isolated per extension**.

- Reset your AI key: `JIRA Smart Commit: Reset AI API Key`
- Reset your JIRA API token: `JIRA Smart Commit: Reset JIRA API Token`

## 🧪 Testing
Placeholder test setup in `test/`. We recommend adding unit tests for:
- `utils.guessTypeFromDiff`  
- `template.renderTemplate`  
- `jiraClient` acceptance extraction

## 📦 Publish
```bash
npm i -g @vscode/vsce
vsce package                 # build .vsix
vsce publish patch|minor|major
```

## 🚀 Advanced Features

### 🎯 Configurable JIRA Key Position

**Problem:** Previously, JIRA keys were always in the footer, and AI could hallucinate or misformat them.

**Solution:** The JIRA key is now **hardcoded** and added programmatically after AI generation, with three placement options:

- **`footer`** (default, recommended): `Refs: JIRA-123` at the bottom
  - ✅ Follows Conventional Commits standard
  - ✅ Keeps subject line clean (≤72 chars)
  - ✅ Auto-linked by GitHub/GitLab/Bitbucket
  
- **`subject-prefix`**: `JIRA-123 feat(scope): message`
  - ✅ Immediately visible in `git log --oneline`
  - ❌ Violates Conventional Commits (type should be first)
  
- **`subject-suffix`**: `feat(scope): message [JIRA-123]`
  - ✅ Visible in oneline logs
  - ✅ Maintains conventional format at start

**Configuration:**
```json
{
  "jiraSmartCommit.jiraKeyPosition": "footer",
  "jiraSmartCommit.relatedIssuesInFooter": true
}
```

**AI Benefit:** The AI no longer generates JIRA keys, eliminating hallucination and allowing it to focus on summarizing changes.

---

### 🧠 Smart Token Allocation

**Problem:** Fixed description length didn't account for token budgets, leading to truncated diffs or insufficient JIRA context.

**Solution:** Intelligent token allocation based on available budget and strategy:

#### Allocation Strategies:

- **`balanced`** (default): 40% description, 60% diff
  - Best for most use cases
  
- **`prefer-description`**: 70% description, 30% diff
  - Use for complex requirements and business logic
  
- **`prefer-diff`**: 30% description, 70% diff
  - Use for large refactorings and code-heavy changes

#### Smart Truncation:

When content exceeds budget:
1. **Paragraph boundary** (70% threshold) — preserves complete sections
2. **Sentence boundary** (50% threshold) — preserves complete thoughts
3. **Word boundary** (80% threshold) — avoids mid-word cuts
4. Appends `...(description truncated)` indicator

**Configuration:**
```json
{
  "jiraSmartCommit.ai.maxTokens": 2048,
  "jiraSmartCommit.descriptionMaxLength": 0,
  "jiraSmartCommit.smartTruncation": true,
  "jiraSmartCommit.tokenAllocationStrategy": "balanced"
}
```

**Token Budget Example (2048 tokens):**
```
Total: 2048 tokens
- System: ~100 tokens
- Response: 300 tokens
- Fixed context: ~200 tokens
----------------------------
Available: ~1450 tokens

Strategy: balanced (40/60 split)
├─→ Description: ~580 tokens (~2300 chars)
└─→ Diff: ~870 tokens (full or partial diff)
```

---

### 🔄 Hybrid Diff Approach

**Problem:** Summaries lacked detail, while full diffs could exceed token budgets.

**Solution:** Dynamic diff inclusion based on available tokens:

1. **Full diff**: If entire diff fits within budget
2. **Partial diff + summary**: Truncated diff with file listing
3. **Summary only**: File changes list (M/A/D/R status)

**How It Works:**
```
┌─────────────────────────────────┐
│ 1. Get full diff from git      │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 2. Calculate existing tokens    │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 3. Check available token budget │
└────────────┬────────────────────┘
             ↓
      ┌──────┴──────┐
      │             │
   Enough?      Not enough?
      │             │
      ▼             ▼
┌──────────┐  ┌──────────────┐
│Full diff │  │Partial/Summary│
└──────────┘  └──────────────┘
```

**Example Outputs:**

**Full diff:**
````diff
Staged changes:
Full diff:
```diff
diff --git a/src/utils.ts b/src/utils.ts
index abc123..def456 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,10 @@
   return value;
 }
+
+export function newFunction() {
+  return 'hello';
+}
```
````

**Summary only:**
```
Staged changes:
- M src/utils.ts
- A src/newfile.ts
- D old-file.js
```

---

### 📜 Commit History Context

**Problem:** AI generated repetitive messages without knowing what was already committed for the same ticket.

**Solution:** Include previous commits for the same JIRA ticket in the AI prompt.

**Benefits:**
- ✅ Avoids repeating information from previous commits
- ✅ Focuses on what's NEW in the current commit
- ✅ Understands ticket progression
- ✅ Generates more accurate and contextual messages

**Configuration:**
```json
{
  "jiraSmartCommit.includeCommitHistory": true,
  "jiraSmartCommit.commitHistoryLimit": 5
}
```

**Example Context:**
```
Previous commits for this ticket (3):
  • a1b2c3d: feat(auth): add login form UI (2 days ago)
  • e4f5g6h: feat(auth): implement JWT token generation (1 day ago)
  • i7j8k9l: test(auth): add login integration tests (3 hours ago)
```

**Use Case Example:**

**Ticket:** `FEAT-456 - Add shopping cart functionality`

**Previous commits:**
- `feat(cart): add cart data model and API endpoints (2 days ago)`
- `feat(cart): implement cart UI components (1 day ago)`

**Current commit (adding persistence):**

**Without history:**
```
feat(cart): add shopping cart functionality  ← Generic!
```

**With history:**
```
feat(cart): add cart persistence with localStorage

Implements cart state persistence across sessions using localStorage.
Previous commits covered data model, API, and UI components.

Refs: FEAT-456
```

**Token Impact:** Each commit uses ~20-40 tokens. For 5 commits, that's ~150 tokens from the fixed context budget.

---

### 🛡️ Robust Fallback Mechanisms

**Problem:** Extension could fail completely if AI was unavailable or misconfigured.

**Solution:** Multi-level fallback hierarchy ensures commit generation always works:

#### Fallback Scenarios:

1. **AI Disabled** → Use conventional commit format (fast, deterministic)
2. **User Cancels API Key** → Show message, use conventional format
3. **AI API Fails** → Catch error, show warning, use conventional format
4. **AI Empty Response** → Silently fall back to baseline
5. **JIRA API Fails** → Show warning, continue with diff-only generation

**Conventional Commit Generator (Baseline):**
```
feat(auth): implement JWT authentication

Implements JWT token generation and validation for secure user authentication.

Acceptance criteria:
- Generate JWT tokens on login
- Validate tokens on protected routes
- Implement token refresh mechanism

Files changed:
- M src/auth/jwt.ts
- A src/auth/middleware.ts
- M src/routes/api.ts

Refs: AUTH-456
```

**User Experience:**
```
┌────────────────────────────────────────┐
│ Enter OpenAI API Key                   │
│                                        │
│ [________________] 🔒                  │
│                                        │
│          [Cancel]  [OK]                │
└────────────────────────────────────────┘

User clicks Cancel
        ↓
"API key not provided. Using conventional commit format instead."
        ↓
✓ Conventional commit generated
```

**Benefits:**
- ✅ Never blocks user from committing
- ✅ Graceful degradation
- ✅ Clear messages about what's happening
- ✅ Works offline (if AI disabled)

---

## 🛣️ Roadmap / Ideas
- ✅ PR description generator (✨ Completed in v0.3.0!)
- ✅ AI enhancement for PR descriptions (✨ Completed in v0.3.0!)
- JIRA Smart Commits (transition/commands)
- More robust breaking-change detection
- Inline code diff heuristics
- Custom PR section templates
- Historical PR analysis for insights

---

This project was scaffolded to be **AI-assistant friendly**. Another AI tool can open `README.md` and reason about the codebase, commands, and settings with minimal context.
