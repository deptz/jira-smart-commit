import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LanguageConfig } from './types';

/**
 * Language detection indicators
 */
const LANGUAGE_INDICATORS = {
  ruby: {
    files: ['Gemfile', 'Rakefile', 'config.ru', '.ruby-version'],
    extensions: ['.rb', '.rake', '.ru'],
    railsIndicators: ['config/application.rb', 'app/controllers', 'app/models']
  },
  go: {
    files: ['go.mod', 'go.sum'],
    extensions: ['.go'],
    testPatterns: ['_test.go']
  }
};

/**
 * Detect the primary programming language and framework
 */
export async function detectProjectLanguage(workspaceRoot: string): Promise<LanguageConfig | null> {
  // Check for Ruby/Rails
  const isRuby = await detectRuby(workspaceRoot);
  if (isRuby) {
    const isRails = await detectRails(workspaceRoot);
    return {
      language: 'ruby',
      framework: isRails ? 'rails' : undefined,
      testFramework: isRails ? 'rspec' : 'minitest',
      coverageTool: 'simplecov'
    };
  }
  
  // Check for Go
  const isGo = await detectGo(workspaceRoot);
  if (isGo) {
    return {
      language: 'go',
      testFramework: 'testing',
      coverageTool: 'go-test'
    };
  }
  
  return null;
}

/**
 * Detect Ruby project
 */
async function detectRuby(workspaceRoot: string): Promise<boolean> {
  const indicators = LANGUAGE_INDICATORS.ruby;
  
  // Check for Ruby-specific files
  for (const file of indicators.files) {
    const filePath = path.join(workspaceRoot, file);
    if (await fileExists(filePath)) {
      return true;
    }
  }
  
  // Check for Ruby files
  const rubyFiles = await vscode.workspace.findFiles('**/*.rb', '**/node_modules/**', 1);
  return rubyFiles.length > 0;
}

/**
 * Detect Rails framework
 */
async function detectRails(workspaceRoot: string): Promise<boolean> {
  const indicators = LANGUAGE_INDICATORS.ruby.railsIndicators;
  
  for (const indicator of indicators) {
    const indicatorPath = path.join(workspaceRoot, indicator);
    if (await fileExists(indicatorPath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect Go project
 */
async function detectGo(workspaceRoot: string): Promise<boolean> {
  const indicators = LANGUAGE_INDICATORS.go;
  
  // Check for Go-specific files
  for (const file of indicators.files) {
    const filePath = path.join(workspaceRoot, file);
    if (await fileExists(filePath)) {
      return true;
    }
  }
  
  // Check for Go files
  const goFiles = await vscode.workspace.findFiles('**/*.go', '**/vendor/**', 1);
  return goFiles.length > 0;
}

/**
 * Get test instructions template based on language
 */
export function getTestInstructionsTemplate(languageConfig: LanguageConfig | null): string {
  if (!languageConfig) {
    return `## Test Instructions
1. Review the changes in this PR
2. Run the test suite
3. Verify all tests pass
4. Test manually if needed`;
  }
  
  switch (languageConfig.language) {
    case 'ruby':
      return getRubyTestInstructions(languageConfig);
    case 'go':
      return getGoTestInstructions();
    default:
      return getGenericTestInstructions();
  }
}

/**
 * Ruby/Rails test instructions template
 */
function getRubyTestInstructions(config: LanguageConfig): string {
  const isRails = config.framework === 'rails';
  const testCommand = config.testFramework === 'rspec' ? 'bundle exec rspec' : 'rake test';
  
  const railsSteps = isRails ? `
3. Run database migrations: \`rails db:migrate RAILS_ENV=test\`
4. Run the test suite: \`${testCommand}\`
5. Check test coverage report (coverage/index.html)
6. Verify coverage meets project standards (≥80% recommended)` : `
3. Run the test suite: \`${testCommand}\`
4. Check test coverage report (coverage/index.html)
5. Verify coverage meets project standards (≥80% recommended)`;

  return `## Test Instructions
1. Pull the branch and install dependencies: \`bundle install\`
2. Set up your test environment${railsSteps}
7. Test the changes manually if applicable`;
}

/**
 * Go test instructions template
 */
function getGoTestInstructions(): string {
  return `## Test Instructions
1. Pull the branch and install dependencies: \`go mod download\`
2. Run the test suite: \`go test ./...\`
3. Run tests with coverage: \`go test -cover ./...\`
4. Generate detailed coverage report: \`go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out\`
5. Verify coverage meets project standards (≥80% recommended)
6. Run any integration tests if applicable
7. Test the changes manually if needed`;
}

/**
 * Generic test instructions template
 */
function getGenericTestInstructions(): string {
  return `## Test Instructions
1. Pull the branch and install dependencies
2. Run the test suite
3. Verify all tests pass
4. Check test coverage if available
5. Test the changes manually if applicable`;
}

/**
 * Get coverage report path based on language
 */
export function getCoverageReportPath(languageConfig: LanguageConfig | null): string | null {
  if (!languageConfig) {
    return null;
  }
  
  switch (languageConfig.coverageTool) {
    case 'simplecov':
      return 'coverage/index.html';
    case 'go-test':
      return 'coverage.out';
    default:
      return null;
  }
}

/**
 * Helper: Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get language-specific file patterns for PR analysis
 */
export function getLanguageFilePatterns(languageConfig: LanguageConfig | null): {
  source: string[];
  test: string[];
  config: string[];
} {
  if (!languageConfig) {
    return {
      source: ['**/*'],
      test: ['**/test/**', '**/tests/**', '**/*.test.*', '**/*.spec.*'],
      config: ['**/*.json', '**/*.yml', '**/*.yaml', '**/*.toml']
    };
  }
  
  switch (languageConfig.language) {
    case 'ruby':
      return {
        source: ['**/*.rb', '!**/spec/**', '!**/test/**'],
        test: ['**/spec/**/*.rb', '**/test/**/*.rb'],
        config: ['Gemfile', 'Gemfile.lock', 'config/**/*.rb', 'config/**/*.yml']
      };
    case 'go':
      return {
        source: ['**/*.go', '!**/*_test.go'],
        test: ['**/*_test.go'],
        config: ['go.mod', 'go.sum', '**/*.yaml', '**/*.yml']
      };
    default:
      return {
        source: ['**/*'],
        test: ['**/test/**', '**/tests/**', '**/*.test.*', '**/*.spec.*'],
        config: ['**/*.json', '**/*.yml', '**/*.yaml', '**/*.toml']
      };
  }
}
