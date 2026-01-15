# Changelog

## 0.3.12 (2026-01-15)

### ✨ New Features

- **Base Branch Filtering** - PR Description and Security Review now analyze only commits unique to your feature branch
  - **Auto-detection**: Automatically detects common base branches (origin/main → origin/master → origin/develop → main → master → develop)
  - **Session Caching**: Base branch selection is cached for the session, preventing re-prompting
  - **Smart Filtering**: Uses Git range syntax (`base..HEAD`) to filter out merged commits from base branch
  - **User-Friendly Messages**: Shows "Auto-detected base branch: origin/main" when detection succeeds
  - Fixes merge commit pollution issue where 33 commits were shown instead of 1 unique commit

### 🔧 Technical Improvements

- **gitOperations.ts Changes**:
  - Added `cachedBaseBranch` variable for session-scoped caching
  - Added `autoDetectBaseBranch()` helper function for common base branch detection
  - Updated `getCommitLog()` signature from `(maxCommits)` to `(baseBranch?, maxCommits)` with range filtering support
  - Added `getFileChangesSinceBase(baseBranch)` for efficient diff calculation using `repo.diffBetween()`
  - Updated `clearRepositoryCache()` to clear both repository and base branch caches

- **prGenerator.ts Changes**:
  - Added base branch detection step in both `generatePRDescription()` and `generatePRDescriptionWithProgress()`
  - Updated to pass `baseBranch` parameter to `getCommitLog()` and use `getFileChangesSinceBase()`
  - Added progress reporting: "Detecting base branch..." and "Analyzing commits unique to {branch}..."
  - Included `baseBranch` in PRContext for transparency

- **securityAnalyzer.ts Changes**:
  - Added `baseBranch` field to `SecurityContext` type
  - Rewrote `getRecentCommitsDiff()` to accept `baseBranch` parameter and use `git diff ${baseBranch}..HEAD`
  - Updated `reviewSecurityWithProgress()` to detect base branch before generating diffs
  - Added `{{BASE_BRANCH}}` placeholder support in security review templates
  - Updated progress messages to show branch-specific analysis

### 📈 Performance Improvements

- **Before**: Analyzed each commit individually, including all merged commits from base branch
- **After**: Single `diffBetween()` call for file changes, filters commits using Git range syntax
- **Result**: Faster generation and more accurate analysis, especially for branches with many merged commits

### ⚠️ Breaking Changes

- `getCommitLog()` signature changed from `getCommitLog(maxCommits: number)` to `getCommitLog(baseBranch?: string, maxCommits: number = 50)`
- The `baseBranch` parameter is optional for backward compatibility, but recommended for accurate commit filtering

### 🎯 Benefits

- **Accurate Analysis**: Only analyzes commits actually made on your feature branch
- **No Merge Commits**: Excludes commits already merged from base branch
- **Better PR Descriptions**: Focuses on actual changes you made
- **Better Security Reviews**: Analyzes only your unique code changes
- **Automatic**: Works out of the box with common branch naming conventions

## 0.3.11 (2025-12-04)

### 🐛 Bug Fixes

- **Enhanced JIRA Description Extraction** - Fixed table content extraction from JIRA tickets
  - Replaced shallow 2-level ADF parser with comprehensive recursive parser that handles all Atlassian Document Format (ADF) node types
  - Now correctly extracts content from complex table structures with nested paragraphs, lists, and formatted text
  - Supports tables, nested bullet/ordered lists, formatted text (bold, italic, code, underline), code blocks, blockquotes, horizontal rules, and inline cards
  - Tables are formatted with clear delimiters (TABLE:, HEADER:, ROW:) and visual separators for better readability
  - Preserves text formatting marks as markdown equivalents (e.g., **bold**, `code`, _underline_)
  - Increased PR description character limit from 500 to 1000 characters
  - Tables are exempt from truncation to preserve complete acceptance criteria and specifications
  - Fixes issue where JIRA tickets with table-based descriptions (e.g., User Story + Acceptance Criteria tables) were not extracted for commit messages, PR descriptions, and first prompt generation

### 🔧 Technical Details

- New functions in `src/jiraClient.ts`:
  - `processADFNode()` - Recursive ADF tree traversal
  - `processInlineContent()` - Inline text and marks processing
  - `applyTextMarks()` - Convert formatting marks to markdown
  - `processTable()` - Format tables with delimiters and separators
- Updated `formatDescription()` in `src/pr/sectionGenerator.ts` to increase limit to 1000 chars and detect tables for truncation exemption

## 0.3.10 (2025-12-03)

### ✨ New Features

- **PR Prerequisites Enforcement** - Require Security Review and Test Coverage to be completed before generating PR Descriptions
  - New setting: `jiraSmartCommit.pr.requirePrerequisites` (default: `true`) to enable/disable prerequisite requirement
  - Branch-specific tracking: Each branch maintains its own prerequisite completion status independently
  - Automatic completion marking: Security Review and Test Coverage commands automatically mark themselves as completed when they finish successfully
  - Persistent state: Completion status is stored in VS Code workspace state, persisting across sessions
  - Team config support: Configure via `.jira-smart-commit.json` to enforce prerequisites across your team
  - Clear error messages: Shows which prerequisites are missing and provides actionable guidance
  - Workflow enforcement: Ensures quality gates (Security Review and Test Coverage) are met before creating pull requests

### 🔧 Technical Details

- New module: `src/pr/prPrerequisites.ts` for prerequisite tracking using VS Code workspace state (Memento)
- Updated `getPRConfigWithTeamDefaults` to include `requirePrerequisites` with proper precedence (user settings > team config > defaults)
- Prerequisite status stored per branch using key format: `prPrerequisites:${branchName}`
- Graceful error handling for cases where branch name cannot be determined

## 0.3.9 (2025-12-03)

### ✨ New Features

- **Security Review** - Analyze all commits on your branch for security vulnerabilities using GitHub Copilot Chat
  - New command: **`JIRA Smart Commit: Review Security`** to perform comprehensive security analysis
  - Analyzes ALL commits on the current branch (no limit, no base branch comparison needed)
  - Matches PR Description behavior: comprehensive analysis of all branch changes
  - Uses OWASP Top 10 and additional security categories for thorough vulnerability detection
  - Configurable via `jiraSmartCommit.security.enabled` and `jiraSmartCommit.security.promptTemplate`
  - Integrates with GitHub Copilot Chat for AI-powered security analysis

- **Test Coverage Enforcement** - Ensure ≥90% test coverage on all changed code using GitHub Copilot Chat
  - New command: **`JIRA Smart Commit: Enforce Test Coverage`** to analyze and enforce test coverage
  - Analyzes all code changes (last commit + staged + unstaged changes)
  - Multi-language support: Go, Ruby, JavaScript/TypeScript, PHP, Python
  - Automatic stack detection: infers language, test framework, and coverage tools
  - Base branch auto-detection: PR base, upstream, or remote default branch
  - Configurable via `jiraSmartCommit.testCoverage.enabled` and `jiraSmartCommit.testCoverage.promptTemplate`
  - Integrates with GitHub Copilot Chat for AI-powered test coverage analysis
  - Team config support: share prompt templates via `.jira-smart-commit.json`

## 0.3.8 (2025-11-22)

### 🎯 Major New Feature: Team Gateway Support

- **Centralized LLM Gateway** - Connect to a single team-managed gateway instead of individual provider APIs
  - New provider type: `team-gateway` for centralized AI endpoint
  - Teams can standardize on the same provider/model across all developers
  - Centralized cost tracking, usage monitoring, and compliance
  - Gateway can implement caching for common responses
  
- **Repository-Level Configuration** - Share settings across your team via `.jira-smart-commit.json`
  - **Team AI Configuration**: Share AI settings across team (`provider`, `model`, `baseUrl`, `maxTokens`, `temperature`)
  - **Repository Settings**: Override workspace settings like `commitTemplate`, `scopeStrategy`, `jiraKeyPosition`
  - **Configuration Precedence**: User settings > Team config > Defaults (allows individual overrides when needed)
  - **Security**: Sensitive fields like `baseUrl` and `email` are ignored in repo config
  - **API Keys**: Individual API keys remain secure in VS Code SecretStorage (never committed to version control)

### ✨ New Features

- **Gemini 3 Pro Support** - Added support for Google's latest Gemini 3 Pro model
  - Access via `gemini-3-pro-preview`
  - Removed deprecated Gemini 1.5 and 2.0 models to keep the list clean
  
- **GPT Codex Support** - Added support for OpenAI's specialized coding models
  - **Models**: `gpt-5.1-codex`, `gpt-5.1-codex-mini`, `gpt-5-codex`
  - **Optimized Integration**: Uses OpenAI's Responses API with specific parameter tuning (no verbosity, adaptive reasoning)
  - Perfect for generating highly technical and accurate commit messages

- **Pre-commit Hook Generator** - Enforce commit standards automatically
  - New command: `JIRA Smart Commit: Install Pre-commit Hook`
  - Installs a local Git hook to validate commit messages against Conventional Commits
  - Ensures all team members follow the same commit format

- **Usage Tracking** - Track team usage of commit generation, PR descriptions, and first prompts
  - Optional metadata collection when team gateway is enabled
  - Tracks feature usage: commit generation, PR descriptions, first prompts
  - Metadata includes: user email, JIRA key, repository, branch, timestamps
  - Sends to separate `/api/tracking` endpoint (configurable)
  - Fire-and-forget with 5-second timeout, fails silently
  - Privacy: SHA-256 email hashing when `anonymizeUser: true`
  - Schema version 1.0 for forward compatibility
  - Works with PR/First Prompt using GitHub Copilot Chat (no AI provider change)

### 🔧 Technical Details

- New client: `src/ai/teamGatewayProvider.ts` with OpenAI-compatible API support
- New config manager: `src/aiConfigManager.ts` for team AI settings
- New telemetry module: `src/telemetry.ts` with usage tracking and SHA-256 hashing
- Configuration precedence: User settings > Team config > Defaults
- Improved OpenAI provider to handle nested Responses API structures
- Usage tracking integrated in: commit generation, PR generation, first prompt generation
- Backward compatible: Existing configurations work without changes

### 🏢 Use Cases

Perfect for teams that want to:
- Control costs and track usage centrally
- Enforce compliance and security policies
- Provide consistent AI experience across team
- Use internal/self-hosted LLM infrastructure
- Cache responses for better performance
- Monitor and analyze AI usage patterns

## 0.3.7 (2025-11-18)

### 🔄 Major Changes
- **PR Description Generator Refactored** - Migrated from AI providers to GitHub Copilot Chat
  - Now uses GitHub Copilot Chat exclusively (same as First Prompt Generator)
  - Removed AI provider configuration for PR descriptions (`pr.ai.*` settings)
  - Simplified workflow: Generate → Review in Copilot → Copy → Paste
  - More consistent experience across all generation features

### 🗑️ Removed Features
- **PR Quality Scoring** - Removed scoring/validation system (no longer relevant with Copilot-based approach)
  - Removed `jiraSmartCommit.pr.minScore` setting
  - Removed `jiraSmartCommit.pr.targetPlatform` setting
  - Removed unused configuration options: `branchPatternPreset`, `customBranchPatterns`, `defaultBaseBranches`, `includeTestInstructions`, `includeCoverage`
  - Simplified codebase by removing validation, scoring, and formatting modules

### ✨ Improvements
- **Cleaner Configuration** - PR Description Generator now has minimal, focused settings:
  - `jiraSmartCommit.pr.enabled` - Toggle feature (requires GitHub Copilot)
  - `jiraSmartCommit.pr.promptTemplate` - Customizable template with `{{CONTEXT}}` placeholder
  - `jiraSmartCommit.pr.autoSubmit` - Auto-submit or manual review mode

- **Enhanced Documentation** - Updated README and HOW-TO-GUIDE to reflect new approach
  - Clarified that GitHub Copilot is required for PR descriptions
  - Removed outdated references to AI providers and scoring
  - Fixed folder structure to show only existing files
  - Updated configuration examples and best practices

### 🔧 Technical Improvements
- Removed unused modules: `scoreCalculator.ts`, `prValidator.ts`, `sectionGenerator.ts`, `prFormatter.ts`, `aiPREnhancer.ts`, `jiraExtractor.ts`
- Simplified `prGenerator.ts` to focus on context building and Copilot integration
- Cleaned up command handlers to remove validation/scoring UI

## 0.3.6 (2025-11-16)

### 🔧 Improvements
- **Enhanced Issue Type Detection** - Improved template selection logic for First Prompt Generator
  - Added support for Sub-task/Subtask issues (uses Task template)
  - Added support for Fast Track/Fasttrack/Incident issues (uses Bug template)
  - Normalized matching handles spaces and hyphens automatically
  - All other issue types default to Task template

- **Configurable Prompt Submission** - Control how prompts are sent to GitHub Copilot Chat
  - Added `jiraSmartCommit.firstPrompt.autoSubmit` setting (default: `false`)
  - When enabled (`true`): Prompt is automatically submitted to Copilot Chat
  - When disabled (`false`): Prompt is pasted into chat input for manual review and submission
  - Gives users control over reviewing prompts before sending

## 0.3.5 (2025-11-15)

#### **First Prompt Generator** - Generate prompts from JIRA issues for GitHub Copilot Chat

### ✨ New Features
- **JIRA-to-Prompt Generator** - Automatically create structured prompts from JIRA tickets
  - Extracts JIRA key from current Git branch name
  - Fetches complete issue details (summary, description, acceptance criteria)
  - Generates context-rich prompts optimized for GitHub Copilot Chat
  - Automatically opens Copilot Chat with pre-filled prompt
  
- **Issue Type-Aware Templates** - Different prompt strategies for different work types
  - **Task/Story Template**: Feature implementation focus with architecture and design thinking
  - **Bug Template**: Root cause analysis with hypothesis-driven debugging approach
  - Customizable templates via settings for your team's workflow
  
- **Multi-Repository Support** - Works seamlessly in multi-repo workspaces
  - Automatically detects and displays available Git repositories
  - Allows repository selection when multiple repos are open
  - Uses VS Code's Git extension API for accurate branch detection
  - Properly extracts JIRA keys from the selected repository's branch

- **Enhanced Configuration Editor** - Better UX for editing prompts and templates
  - All prompt/template fields now use multi-line text areas instead of single-line inputs
  - Makes editing long prompts much more comfortable
  - Affects: `commitTemplate`, `systemPrompt`, `userPromptTemplate`, `taskTemplate`, `bugTemplate`

### 🐛 Bug Fixes
- **Branch Pattern Detection** - Fixed JIRA key extraction from branch names with prefixes (e.g., `bugfix/`, `feature/`)
  - Updated default pattern from `(?<key>[A-Z][A-Z0-9]+-\d+)` to `(?:^|/)(?<key>[A-Z][A-Z0-9]+-\d+)`
  - Now correctly extracts keys from: `bugfix/QON-123-description`, `feature/ABC-456-name`, etc.
  - Improved error messages showing actual branch name with prefix examples
- **Code Cleanup** - Removed duplicate default templates from TypeScript code (now only in `package.json`)

### 📝 Commands
- **New**: `JIRA Smart Commit: First Prompt Generator` - Generate AI prompt from JIRA issue

### ⚙️ Configuration
- `jiraSmartCommit.firstPrompt.taskTemplate` - Template for Task/Story type issues
- `jiraSmartCommit.firstPrompt.bugTemplate` - Template for Bug/Defect type issues

## 0.3.4 (2025-11-15)

#### **GPT-5.1 Support** - Added support for OpenAI's latest flagship model
- **New OpenAI Models** - Added GPT-5.1 and GPT-5 Nano to the model selection
  - **GPT-5.1**: Latest flagship model with enhanced reasoning capabilities and improved performance
  - **GPT-5 Nano**: High-throughput, cost-optimized model for simple tasks
  - Both models are part of OpenAI's new GPT-5 family with advanced capabilities

- **Enhanced OpenAI Provider** - Optimized implementation for GPT-5 models
  - **Responses API Integration**: GPT-5.1 uses the new Responses API for better performance and lower latency
  - **Parameter Compatibility**: Automatic handling of parameter differences for GPT-5 models (no temperature support)
  - **Optimal Settings**: Pre-configured with `reasoning: none` for fast responses and `verbosity: medium` for clear commit messages
  - **Backward Compatibility**: All existing OpenAI models continue to work with Chat Completions API

- **Smart API Selection** - Automatically chooses the best API endpoint
  - GPT-5.1 uses Responses API for enhanced performance
  - All other models continue using Chat Completions API
  - Seamless fallback ensures reliability across model types

### 🔧 Configuration
- Select `"gpt-5.1"` or `"gpt-5-nano"` in VS Code settings under `jiraSmartCommit.ai.model`
- No additional configuration needed - provider automatically optimizes API calls
- GPT-5.1 recommended for complex commit message generation with superior reasoning

## 0.3.3 (2025-11-08)

#### **Moonshot AI Support** - Added support for Kimi (Moonshot AI) provider
- **New AI Provider** - Added Moonshot as a supported AI provider
  - Support for all 14 Moonshot models including K2 series with up to 262k context
  - Models available: `kimi-k2-turbo-preview`, `kimi-k2-thinking-turbo`, `kimi-latest`, and more
  - Vision models: `moonshot-v1-*-vision-preview` variants for enhanced capabilities
  
- **Extended Model Selection** - Comprehensive model options
  - **K2 Series** (Latest): `kimi-k2-turbo-preview`, `kimi-k2-thinking-turbo`, `kimi-k2-thinking` (262k context)
  - **Standard Models**: `kimi-latest`, `kimi-thinking-preview`, `moonshot-v1-auto` (131k context)
  - **Legacy Models**: `moonshot-v1-128k`, `moonshot-v1-32k`, `moonshot-v1-8k`
  - **Vision Models**: Enhanced image understanding capabilities
  
- **Complete Integration** - Seamless integration with existing AI features
  - Works with both commit message generation and PR description enhancement
  - Follows existing API key management and secure storage patterns
  - Uses Moonshot's official API endpoint: `https://api.moonshot.cn/v1`
  
- **Documentation Updates** - Updated guides and examples
  - Updated README.md with Moonshot provider information
  - Included context window information for model selection guidance

### 🔧 Configuration
- Set `jiraSmartCommit.ai.provider` to `"moonshot"`
- Choose from 14+ available Kimi models in VS Code settings
- API key will be requested on first use and stored securely

## 0.3.2 (2025-10-24)

#### **Windows Compatibility Fixes** - Complete cross-platform shell command support
- **Fixed Windows Git Command Issues** - Resolved shell escaping problems causing commit failures
  - Fixed `git commit` command failing on Windows with "pathspec did not match any files" error
  - Implemented cross-platform shell argument escaping for Windows Command Prompt and PowerShell
  - Added proper double-quote escaping for Windows vs single-quote escaping for Unix/Linux/macOS
  
- **Enhanced Multi-Repo Windows Support** - All multi-repository features now work correctly on Windows
  - Fixed JIRA key search in git log commands that could fail on Windows
  - Centralized shell escaping utility in `utils.ts` for consistent cross-platform behavior
  - Verified all git command executions across the entire codebase for Windows compatibility
  
- **Security Improvements** - Prevented potential shell injection vulnerabilities
  - All dynamic git command arguments now properly escaped on all platforms
  - Eliminated unsafe string interpolation in shell commands
  - Added comprehensive protection against special characters in commit messages and JIRA keys

### 🔧 Bug Fixes
- Windows users can now successfully commit messages with spaces and special characters
- Multi-repo functionality works correctly on Windows Command Prompt and PowerShell
- Git log searches for JIRA keys no longer fail on Windows systems

## 0.3.0 (2025-10-21)

#### **Multi-Root Workspace Support** - Work seamlessly with monorepos and multiple Git projects (Experimental) 
- **Smart Repository Detection** - Automatically detects the repository based on active file
  - Uses VS Code's built-in Git API for reliable repository detection
  - Seamlessly works with single and multi-root workspaces
  
- **Repository Picker** - Select target repository when working with multiple projects
  - Shows repository picker when multiple Git repositories are detected
  - Displays repository name and full path for easy identification
  - Single repository: works exactly as before with zero changes
  
- **Enhanced Status Bar** - Display current repository context
  - Format: `JIRA: ABC-123 (repo-name)` shows both JIRA key and repository
  - Dynamically updates when switching between files in different repos
  - Clear indication when no repository is found: `JIRA: (no repo)`
  
- **Unified Experience** - All features work with multi-root support
  - Commit message generation: Select repository, generate from staged changes
  - PR description generation: Works with selected repository's Git history
  - JIRA integration: Detects JIRA key from branch in selected repository
  
- **Error Handling** - User-friendly errors with actionable guidance
  - Clear messages when Git extension is not available
  - Helpful guidance when no Git repository is found
  - Graceful handling of repository selection cancellation

#### **PR Description Generator** - Generate comprehensive PR descriptions from Git commits (Experimental)
- **Automatic Branch Analysis** - Extract JIRA key from branch name using configurable patterns
  - 3 presets: Standard, Feature-based, User-based + Custom regex patterns
  - Supports common workflows: feature/ABC-123, username/ABC-123, ABC-123-description
  
- **JIRA Integration** - Fetch and integrate JIRA issue context into PR descriptions
  - Includes summary, description, acceptance criteria, related issues
  - Reuses existing JIRA authentication (no additional setup)
  
- **Language Detection** - Auto-detect project language and framework
  - Ruby/Rails: Detects Gemfile, Rails structure, provides RSpec/Minitest instructions
  - Go: Detects go.mod, provides go test instructions
  - Extensible architecture for future languages
  
- **Test Coverage Detection** - Parse and display test coverage automatically
  - SimpleCov for Ruby/Rails: Parses coverage/.resultset.json
  - go test for Go: Parses coverage.out
  - Shows coverage percentage and validates against 80% threshold
  
- **5 Mandatory Sections** - Comprehensive PR structure
  - **Summary**: JIRA context + high-level overview
  - **What Changed**: Changes grouped by type (feat/fix/refactor) + file statistics
  - **Testing**: Language-specific test instructions + coverage info
  - **Impact & Risks**: Breaking changes, migrations, config changes, deployment notes
  - **Additional Notes**: Acceptance criteria, related issues, technical details
  
- **Validation System** - Ensure PR description quality
  - Check all sections present and non-empty
  - Minimum 50 characters per section
  - Detect placeholder text (TODO, TBD, etc.)
  - Section-specific validation (e.g., Testing must have step-by-step instructions)
  - Actionable improvement suggestions
  
- **Platform Support** - Format for different code review platforms
  - Bitbucket (default)
  - GitHub
  - GitLab
  - Markdown formatting preserved across platforms

#### **AI-Powered Enhancement** (Optional)
- **LLM Integration** - Enhance PR descriptions using AI
  - Reuses existing AI provider configuration (OpenAI, Anthropic, Gemini, Ollama)
  - No additional API keys needed
  
- **3 Enhancement Levels**
  - **Minimal**: Grammar and spelling fixes only
  - **Balanced**: Improve clarity, add context (recommended)
  - **Detailed**: Comprehensive explanations with architectural context
  
- **Smart Prompts** - Context-aware AI enhancement
  - Uses commit history, JIRA data, language context
  - Section-specific enhancement strategies
  - Maintains markdown formatting and links
  - Preserves all JIRA references
  
- **Quality Improvement** 
  - Better explanations and flow
  - Additional helpful context
  - Professional technical writing

### ⚙️ Configuration

#### New Settings (PR Generator)
- `jiraSmartCommit.pr.enabled` - Enable/disable PR generator (default: true)
- `jiraSmartCommit.pr.branchPatternPreset` - Branch naming pattern (standard/feature-based/user-based/custom)
- `jiraSmartCommit.pr.customBranchPatterns` - Custom regex patterns array
- `jiraSmartCommit.pr.defaultBaseBranches` - Base branch priority list (main/master/develop)
- `jiraSmartCommit.pr.includeTestInstructions` - Include test steps (default: true)
- `jiraSmartCommit.pr.includeCoverage` - Include coverage info (default: true)
- `jiraSmartCommit.pr.minScore` - Minimum quality score (default: 85)
- `jiraSmartCommit.pr.targetPlatform` - Format target (bitbucket/github/gitlab)

#### New Settings (AI Enhancement)
- `jiraSmartCommit.pr.ai.enabled` - Enable AI enhancement (default: false)
- `jiraSmartCommit.pr.ai.enhanceLevel` - Enhancement level (minimal/balanced/detailed)
- `jiraSmartCommit.pr.ai.provider` - Provider override (inherits from parent if empty)
- `jiraSmartCommit.pr.ai.model` - Model override (inherits from parent if empty)

### 📝 Commands
- **New**: `JIRA Smart Commit: Generate PR Description` - Generate comprehensive PR description

### 🎨 User Experience
- **Progress Notifications** - Real-time progress during generation
  - 10 detailed steps with incremental updates
  - AI enhancement step (if enabled)
  - Clear error messages with actionable guidance
  
- **Interactive Dialogs** - User-friendly result presentation
  - One-click copy to clipboard
  - Markdown preview with metadata
  - Validation warnings in output channel
  
- **Before/After Comparison** - See AI improvements
  - Length difference calculation
  - Sections improved list
  - Improvement summary

### 📈 Performance
- Fast generation: <2 seconds for typical PR
- Efficient: Single JIRA API call, cached results
- Non-blocking: Async/await throughout
- Optional AI: Can be disabled for speed

### 🔒 Security
- Reuses existing secure secrets storage
- No new permissions required
- JIRA API tokens encrypted
- AI API keys encrypted

## 0.2.1 (2025-10-18)

### ✨ Features
- **Commit Preview Modal** - Added modal dialog to "Commit Now" command for safety
  - Users can now review commit messages before committing
  - Three options: "Commit Now", "Edit in Git Input", or "Cancel"
  - Prevents accidental commits with wrong messages
  - Non-breaking change - other commands work as before
- **Progress Indicators** - Added status bar progress notifications during commit message generation
  - Shows detailed steps: fetching JIRA, analyzing changes, calling AI, finalizing
  - Visual feedback with progress percentage
  - Users now know when the extension is actively working

### 🤖 AI Models
- **Added Claude Haiku 4.5 support** - Latest fast and cost-effective Anthropic model
  - Fast response times for quick commit generation
  - Lower cost compared to Sonnet/Opus models
  - Available in AI model selection dropdown

### 🐛 Bug Fixes
- **Fixed OpenAI API compatibility** - Updated to use `max_completion_tokens` parameter
  - Resolves "Unsupported parameter: 'max_tokens'" error with newer OpenAI models
  - Now compatible with GPT-4, GPT-4 Turbo, GPT-4o, and other current models
  - Aligns with OpenAI's latest API specification

### 🔧 Improvements
- Replaced console.log with VS Code Output Channel for professional logging
  - Logs now appear in dedicated "JIRA Smart Commit" output channel
  - Users can view/hide logs via Output panel
  - Better debugging experience for troubleshooting

### 📦 Publishing
- Removed proposed API usage (`contribSourceControlInputBoxMenu`) for marketplace compliance
- Extension now publishable to VS Code Marketplace
- Added MIT License and complete repository metadata
- Added extension icon and keywords for better discoverability

### 📚 Documentation
- Updated README with commit preview workflow
- Added implementation plan document (IMPLEMENTATION_PLAN_COMMIT_PREVIEW.md)
- Improved command usage instructions

## 0.2.0 (2025-10-13)

### ✨ Features
- **Full Conventional Commits 1.0.0 compliance** - Messages now strictly follow the official specification
- Removed emojis from file change listings (not part of spec, breaks parsing tools)
- Enhanced AI system prompt with complete Conventional Commits specification
- Improved commit message structure with proper type/scope/description format
- Updated documentation with comprehensive Conventional Commits guide

### 🔧 Changes
- File changes now show descriptive labels: "Added", "Modified", "Deleted" instead of emojis
- AI generates messages with imperative mood, lowercase descriptions, ≤72 chars
- Template body structure simplified (removed "Why:" label for natural flow)
- System prompt enforces proper footer format: "Token: value"
- Breaking changes properly formatted with "!" or "BREAKING CHANGE:" footer

### 📚 Documentation
- Added complete Conventional Commits 1.0.0 specification section
- Added "No Emojis" clarification
- Added multiple example messages showing proper format
- Added CONVENTIONAL_COMMITS_IMPLEMENTATION.md with detailed changes

## 0.1.0
- Initial release: JIRA fetch, Git diff analysis, templated commits, AI polishing (OpenAI/Anthropic/Gemini/Ollama), SecretStorage for keys.
