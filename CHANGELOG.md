
# Changelog

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
