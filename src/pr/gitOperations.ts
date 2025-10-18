import * as vscode from 'vscode';
import { CommitInfo, FileChange } from './types';
import { getBranchPatterns } from './configPresets';

/**
 * Get the Git extension API
 */
function getGitExtension(): any {
  const extension = vscode.extensions.getExtension('vscode.git');
  if (!extension) {
    throw new Error('Git extension not found');
  }
  
  if (!extension.isActive) {
    throw new Error('Git extension not active');
  }
  
  return extension.exports.getAPI(1);
}

/**
 * Get the active Git repository
 */
export function getRepository(): any {
  const git = getGitExtension();
  const repositories = git.repositories;
  
  if (repositories.length === 0) {
    throw new Error('No Git repository found');
  }
  
  // Return the first repository (most common case)
  // TODO: Handle multiple repositories/workspaces
  return repositories[0];
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const repo = getRepository();
  const head = repo.state.HEAD;
  
  if (!head || !head.name) {
    throw new Error('Could not determine current branch');
  }
  
  return head.name;
}

/**
 * Extract JIRA key from branch name using configured patterns
 */
export function extractJiraKeyFromBranch(branchName: string): string | null {
  const patterns = getBranchPatterns();
  
  for (const pattern of patterns) {
    const match = branchName.match(pattern);
    if (match) {
      // Return first capture group or named group
      return match[1] || match.groups?.key || null;
    }
  }
  
  return null;
}

/**
 * Get base branch (target branch for PR)
 * Returns the tracking branch or configured default
 */
export async function getBaseBranch(currentBranch: string): Promise<string> {
  const repo = getRepository();
  
  // Try to get upstream branch
  const head = repo.state.HEAD;
  if (head?.upstream) {
    // Extract branch name from refs/remotes/origin/main
    const upstreamName = head.upstream.name;
    const parts = upstreamName.split('/');
    return parts[parts.length - 1];
  }
  
  // Fall back to common base branches
  const defaultBranches = ['main', 'master', 'develop'];
  const config = vscode.workspace.getConfiguration('jiraSmartCommit.pr');
  const configuredBranches = config.get<string[]>('defaultBaseBranches', defaultBranches);
  
  // Check which base branch exists
  const refs = await repo.getRefs();
  for (const baseBranch of configuredBranches) {
    const exists = refs.some((ref: any) => 
      ref.name === baseBranch || ref.name === `origin/${baseBranch}`
    );
    if (exists) {
      return baseBranch;
    }
  }
  
  // Default to 'main'
  return 'main';
}

/**
 * Get commit log between current branch and base branch
 */
export async function getCommitLog(baseBranch: string): Promise<CommitInfo[]> {
  const repo = getRepository();
  const currentBranch = await getCurrentBranch();
  
  // Get commits that are in current branch but not in base
  const log = await repo.log({
    range: `${baseBranch}..${currentBranch}`,
    maxEntries: 100
  });
  
  const commits: CommitInfo[] = log.map((commit: any) => ({
    hash: commit.hash.substring(0, 7),
    message: commit.message.split('\n')[0],
    body: commit.message.split('\n').slice(1).join('\n').trim() || undefined,
    author: commit.authorName || commit.authorEmail,
    date: new Date(commit.authorDate || commit.commitDate),
    files: [] // Files will be populated separately if needed
  }));
  
  return commits;
}

/**
 * Get file changes between current branch and base branch
 */
export async function getFileChanges(baseBranch: string): Promise<FileChange[]> {
  const repo = getRepository();
  const currentBranch = await getCurrentBranch();
  
  // Get diff between branches
  const diff = await repo.diffBetween(baseBranch, currentBranch);
  
  if (!diff) {
    return [];
  }
  
  const changes: FileChange[] = diff.map((change: any) => {
    let status: FileChange['status'] = 'modified';
    let oldPath: string | undefined;
    
    // Map Git status to our FileChange status
    switch (change.status) {
      case 0: // INDEX_MODIFIED
      case 1: // INDEX_ADDED
      case 5: // MODIFIED
        status = 'modified';
        break;
      case 2: // INDEX_DELETED
      case 6: // DELETED
        status = 'deleted';
        break;
      case 3: // INDEX_RENAMED
        status = 'renamed';
        oldPath = change.originalUri?.fsPath;
        break;
      case 7: // UNTRACKED
        status = 'added';
        break;
      default:
        status = 'modified';
    }
    
    return {
      path: change.uri.fsPath,
      status,
      additions: 0,  // VS Code Git API doesn't provide these
      deletions: 0,
      oldPath
    };
  });
  
  return changes;
}

/**
 * Get detailed diff for a specific file
 */
export async function getFileDiff(
  filePath: string,
  baseBranch: string
): Promise<string> {
  const repo = getRepository();
  const currentBranch = await getCurrentBranch();
  
  // Get diff content
  const diff = await repo.diffWith(baseBranch, filePath);
  return diff || '';
}

/**
 * Check if working directory is clean
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  const repo = getRepository();
  const changes = repo.state.workingTreeChanges;
  const indexChanges = repo.state.indexChanges;
  
  return changes.length === 0 && indexChanges.length === 0;
}

/**
 * Get remote URL for the repository
 */
export async function getRemoteUrl(): Promise<string | null> {
  const repo = getRepository();
  const remotes = repo.state.remotes;
  
  if (remotes.length === 0) {
    return null;
  }
  
  // Prefer 'origin' remote
  const origin = remotes.find((r: any) => r.name === 'origin');
  const remote = origin || remotes[0];
  
  // Return the fetch URL
  return remote.fetchUrl || remote.pushUrl || null;
}

/**
 * Parse Bitbucket repository info from remote URL
 */
export function parseBitbucketUrl(remoteUrl: string): {
  workspace: string;
  repo: string;
} | null {
  // Match both HTTPS and SSH formats
  // HTTPS: https://bitbucket.org/workspace/repo.git
  // SSH: git@bitbucket.org:workspace/repo.git
  
  const httpsMatch = remoteUrl.match(/bitbucket\.org[\/:]([^\/]+)\/([^\/\.]+)/);
  if (httpsMatch) {
    return {
      workspace: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }
  
  return null;
}

/**
 * Get repository root path
 */
export function getRepositoryRoot(): string {
  const repo = getRepository();
  return repo.rootUri.fsPath;
}

/**
 * Check if a branch exists locally
 */
export async function branchExists(branchName: string): Promise<boolean> {
  const repo = getRepository();
  const refs = await repo.getRefs();
  
  return refs.some((ref: any) => ref.name === branchName);
}

/**
 * Check if a branch exists on remote
 */
export async function remoteBranchExists(branchName: string): Promise<boolean> {
  const repo = getRepository();
  const refs = await repo.getRefs();
  
  return refs.some((ref: any) => 
    ref.name === `origin/${branchName}` || ref.name === `refs/remotes/origin/${branchName}`
  );
}
