
export const VALIDATION_SCRIPT = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const commitMsgFile = process.argv[2];
const rootDir = process.cwd();

// Default config
const config = {
  pattern: /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\\(.+\\))?: .+/
};

// Try to load repo config
try {
  const configPath = path.join(rootDir, '.jira-smart-commit.json');
  if (fs.existsSync(configPath)) {
    const repoConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Add any repo-specific validation rules here if needed
  }
} catch (e) {
  // Ignore config load errors
}

try {
  const msg = fs.readFileSync(commitMsgFile, 'utf8').trim();
  
  // Allow merges and reverts
  if (msg.startsWith('Merge ') || msg.startsWith('Revert ')) {
    process.exit(0);
  }

  if (!config.pattern.test(msg)) {
    console.error('\\x1b[31m[ERROR] Invalid commit message format.\\x1b[0m');
    console.error('Commit message must follow Conventional Commits format:');
    console.error('  <type>(<scope>): <subject>');
    console.error('Examples:');
    console.error('  feat(auth): add login page');
    console.error('  fix: resolve null pointer exception');
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error('Failed to validate commit message:', error);
  process.exit(1);
}
`;
