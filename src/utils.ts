
import * as vscode from 'vscode';
import { DiffSummary } from './diffAnalyzer';

export type Config = {
  baseUrl: string;
  email: string;
  branchPattern: string;
  enableConventionalCommits: boolean;
  commitTemplate: string;
  commitDirectly: boolean;
  scopeStrategy: 'packageJson' | 'folder' | 'auto' | 'none';
  detectBreakingChanges: boolean;
  fetchRelatedIssues: boolean;
  relatedIssuesInFooter: boolean;
  includeJiraDetailsInBody: boolean;
  descriptionMaxLength: number;
  smartTruncation: boolean;
  tokenAllocationStrategy: 'balanced' | 'prefer-description' | 'prefer-diff';
  includeCommitHistory: boolean;
  commitHistoryLimit: number;
  jiraKeyPosition: 'footer' | 'subject-prefix' | 'subject-suffix';
};

export function getConfig(): Config {
  const cfg = vscode.workspace.getConfiguration('jiraSmartCommit');
  return {
    baseUrl: cfg.get<string>('baseUrl', ''),
    email: cfg.get<string>('email', ''),
    branchPattern: cfg.get<string>('branchPattern', '(?<key>[A-Z][A-Z0-9]+-\\d+)')!,
    enableConventionalCommits: cfg.get<boolean>('enableConventionalCommits', true)!,
    commitTemplate: cfg.get<string>('commitTemplate', ''),
    commitDirectly: cfg.get<boolean>('commitDirectly', false)!,
    scopeStrategy: cfg.get<'packageJson'|'folder'|'auto'|'none'>('scopeStrategy', 'packageJson')!,
    detectBreakingChanges: cfg.get<boolean>('detectBreakingChanges', true)!,
    fetchRelatedIssues: cfg.get<boolean>('fetchRelatedIssues', false)!,
    relatedIssuesInFooter: cfg.get<boolean>('relatedIssuesInFooter', true)!,
    includeJiraDetailsInBody: cfg.get<boolean>('includeJiraDetailsInBody', false)!,
    descriptionMaxLength: cfg.get<number>('descriptionMaxLength', 0)!,
    smartTruncation: cfg.get<boolean>('smartTruncation', true)!,
    tokenAllocationStrategy: cfg.get<'balanced'|'prefer-description'|'prefer-diff'>('tokenAllocationStrategy', 'balanced')!,
    includeCommitHistory: cfg.get<boolean>('includeCommitHistory', true)!,
    commitHistoryLimit: Math.min(cfg.get<number>('commitHistoryLimit', 5)!, 10), // Cap at 10
    jiraKeyPosition: cfg.get<'footer'|'subject-prefix'|'subject-suffix'>('jiraKeyPosition', 'footer')!,
  };
}

export async function ensureApiToken(context: vscode.ExtensionContext): Promise<string> {
  const secretKey = 'jiraSmartCommit.jira.apiToken';
  const existing = await context.secrets.get(secretKey);
  if (existing) return existing;

  const token = await vscode.window.showInputBox({
    title: 'Enter JIRA API Token',
    password: true,
    ignoreFocusOut: true
  });

  if (!token) throw new Error('JIRA API token is required.');
  await context.secrets.store(secretKey, token);
  return token;
}

export async function inferScope(strategy: 'packageJson'|'folder'|'auto'|'none', diff?: DiffSummary): Promise<string> {
  if (strategy === 'none') return '';
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return '';

  // Auto-detect scope from changed files (useful for monorepos and clean architecture)
  if (strategy === 'auto' && diff?.files.length) {
    const scope = inferScopeFromFiles(diff.files.map(f => f.path));
    if (scope) return scope;
    // Fall back to folder name if auto-detection fails
    return sanitizeScope(folders[0].name);
  }

  if (strategy === 'folder') {
    const name = folders[0].name;
    return sanitizeScope(name);
  }

  // packageJson strategy: Try to infer from files first, then fall back to package name
  // This provides better scopes for monorepos and structured projects
  if (strategy === 'packageJson' && diff?.files.length) {
    const scopeFromFiles = inferScopeFromFiles(diff.files.map(f => f.path));
    if (scopeFromFiles) {
      return scopeFromFiles;
    }
  }

  // Try package.json (Node.js), go.mod (Go), or Gemfile (Ruby)
  try {
    // Node.js: package.json
    const pkgUri = vscode.Uri.joinPath(folders[0].uri, 'package.json');
    const pkgBuf = await vscode.workspace.fs.readFile(pkgUri);
    const pkgJson = JSON.parse(Buffer.from(pkgBuf).toString('utf8'));
    if (pkgJson?.name) return sanitizeScope(pkgJson.name);
  } catch {}

  try {
    // Go: go.mod
    const goModUri = vscode.Uri.joinPath(folders[0].uri, 'go.mod');
    const goModBuf = await vscode.workspace.fs.readFile(goModUri);
    const goModContent = Buffer.from(goModBuf).toString('utf8');
    const match = goModContent.match(/^module\s+(.+)$/m);
    if (match?.[1]) {
      // Extract last part of module path (e.g., "github.com/user/repo" -> "repo")
      const modulePath = match[1].trim();
      const parts = modulePath.split('/');
      return sanitizeScope(parts[parts.length - 1]);
    }
  } catch {}

  return sanitizeScope(folders[0].name);
}

/**
 * Infer scope from file paths - useful for monorepos and clean architecture
 * Detects common patterns in Go, Rails, and Clean Architecture projects
 */
function inferScopeFromFiles(paths: string[]): string {
  // Collect all potential scopes from file paths
  const scopes = new Set<string>();
  
  for (const path of paths) {
    // Clean Architecture layers: domain, usecase, infrastructure, presentation
    const cleanArchMatch = path.match(/(domain|usecase|infrastructure|presentation|adapter|delivery)\/([^\/]+)/);
    if (cleanArchMatch) {
      scopes.add(cleanArchMatch[2]);
      continue;
    }
    
    // Go: cmd/service-name, pkg/module-name, internal/component-name
    const goMatch = path.match(/^(cmd|pkg|internal)\/([^\/]+)/);
    if (goMatch) {
      scopes.add(goMatch[2]);
      continue;
    }
    
    // Rails: app/models/user.rb -> user, app/controllers/api/posts_controller.rb -> posts
    const railsMatch = path.match(/app\/(models|controllers|services|jobs|mailers)\/(?:api\/)?([^\/]+?)(?:_controller|_mailer|_job)?\.rb$/);
    if (railsMatch) {
      scopes.add(railsMatch[2]);
      continue;
    }
    
    // Generic: src/module-name, lib/component-name
    const genericMatch = path.match(/^(src|lib)\/([^\/]+)/);
    if (genericMatch) {
      scopes.add(genericMatch[2]);
      continue;
    }
  }
  
  // If all files share the same scope, use it
  if (scopes.size === 1) {
    return sanitizeScope([...scopes][0]);
  }
  
  // If multiple scopes, try to find the most common one
  if (scopes.size > 1 && scopes.size <= 3) {
    // Return the first scope alphabetically for consistency
    return sanitizeScope([...scopes].sort()[0]);
  }
  
  return '';
}

function sanitizeScope(s: string): string {
  return s.replace(/^@/, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-]/gi, '').toLowerCase();
}

export function guessTypeFromDiff(diff: DiffSummary): string {
  // Test files detection (Go, Ruby, JS/TS, Python, etc.)
  const hasOnlyTests = diff.files.length && diff.files.every(f => 
    /test|spec|_test\.go$/i.test(f.path)
  );
  if (hasOnlyTests) return 'test';

  // Source code directories detection
  // Supports:
  // - JavaScript/TypeScript: src/, lib/, app/
  // - Go: cmd/, pkg/, internal/, domain/, usecase/, repository/, handler/
  // - Ruby on Rails: app/, lib/, config/routes, config/initializers
  // - Clean Architecture: domain/, usecase/, infrastructure/, presentation/, adapter/
  const sourcePatterns = [
    /(^|\/)(src|lib|app)\//,                           // JS/TS/Ruby standard
    /(^|\/)(cmd|pkg|internal)\//,                      // Go standard layout
    /(^|\/)(domain|usecase|repository|handler|service)\//,  // Clean Architecture / DDD
    /(^|\/)(infrastructure|presentation|adapter|delivery)\//,  // Clean Architecture
    /(^|\/)(entity|controller|model|view|helper)\//,   // MVC / Rails
    /(^|\/)app\/(models|controllers|services|jobs|mailers|channels)\//  // Rails specific
  ];
  
  const isSourceCode = diff.files.some(f => sourcePatterns.some(pattern => pattern.test(f.path)));
  
  if (isSourceCode) {
    // Detect feature: new files added
    if (diff.files.some(f => f.status === 'A')) return 'feat';
    // Detect refactor: files deleted
    if (diff.files.some(f => f.status === 'D')) return 'refactor';
    // Default: bug fix for modifications
    return 'fix';
  }

  // Documentation files
  if (diff.files.some(f => /\.(md|mdx|rdoc)$/.test(f.path))) return 'docs';
  
  // Database migrations (Rails, Go migrations)
  if (diff.files.some(f => 
    /(^|\/)db\/migrate\//i.test(f.path) ||           // Rails migrations
    /(^|\/)migrations?\//i.test(f.path) ||           // Go migrations
    /\.sql$/.test(f.path)                            // SQL files
  )) return 'feat';  // Migrations are typically new features
  
  // Configuration files
  if (diff.files.some(f =>
    /(^|\/)config\//i.test(f.path) ||                // Config directory
    /\.(yml|yaml|toml|ini|env|properties)$/.test(f.path) ||  // Config file extensions
    /Dockerfile|docker-compose/.test(f.path) ||      // Docker
    /\.github\/workflows/.test(f.path)               // GitHub Actions
  )) return 'chore';
  
  // Build and dependency files
  if (diff.files.some(f =>
    /(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(f.path) ||  // Node
    /go\.(mod|sum)$/.test(f.path) ||                 // Go
    /(Gemfile|Gemfile\.lock)$/.test(f.path) ||       // Ruby
    /(Makefile|Rakefile)$/.test(f.path)              // Build files
  )) return 'build';
  
  // CI/CD files
  if (diff.files.some(f =>
    /\.(gitlab-ci|travis|circleci|jenkins)\.yml$/.test(f.path) ||
    /\.github\/workflows/.test(f.path) ||
    /Jenkinsfile/.test(f.path)
  )) return 'ci';
  
  // Scripts
  if (diff.files.some(f => 
    /(^|\/)scripts?\//i.test(f.path) ||
    /\.(sh|bash|zsh)$/.test(f.path)
  )) return 'chore';
  
  // Default fallback
  return 'chore';
}

export function detectBreaking(diff: DiffSummary): boolean {
  return diff.hasMigrations || diff.deletedPublicApis.length > 0;
}

export async function resetJiraApiToken(context: vscode.ExtensionContext): Promise<void> {
  const secretKey = 'jiraSmartCommit.jira.apiToken';
  await context.secrets.delete(secretKey);
  vscode.window.showInformationMessage('JIRA API token has been reset. You will be prompted for a new token on next use.');
}
