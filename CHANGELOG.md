
# Changelog

## 0.2.1 (2025-10-18)

### ✨ Features
- **Commit Preview Modal** - Added modal dialog to "Commit Now" command for safety
  - Users can now review commit messages before committing
  - Three options: "Commit Now", "Edit in Git Input", or "Cancel"
  - Prevents accidental commits with wrong messages
  - Non-breaking change - other commands work as before

### 🤖 AI Models
- **Added Claude Haiku 4.5 support** - Latest fast and cost-effective Anthropic model
  - Fast response times for quick commit generation
  - Lower cost compared to Sonnet/Opus models
  - Available in AI model selection dropdown

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
