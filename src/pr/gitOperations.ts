import * as vscode from 'vscode';
import { CommitInfo, FileChange } from './types';
import { getBranchPatterns } from './configPresets';
import { getGitAPI, pickRepository, RepositoryInfo } from '../utils';

// Cache the selected repository for the current PR generation session
let cachedRepository: RepositoryInfo | null = null;
// Cache the selected base branch for the current PR generation session
let cachedBaseBranch: string | null = null;

/**
 * Get the active Git repository for PR operations
 * @returns Repository info or throws error if none found
 */
export async function getRepository(): Promise<RepositoryInfo> {
  // Return cached repository if available
  if (cachedRepository) {
    return cachedRepository;
  }
  
  const repoInfo = await pickRepository();
  if (!repoInfo) {
    throw new Error('No Git repository found or selected');
  }
  
  // Cache the selected repository
  cachedRepository = repoInfo;
  return repoInfo;
}

/**
 * Clear the cached repository and base branch (call this when starting a new PR generation)
 */
export function clearRepositoryCache(): void {
  cachedRepository = null;
  cachedBaseBranch = null;
}

/**
 * Clear only the base branch cache (useful for testing or changing target branch)
 */
export function clearBaseBranchCache(): void {
  cachedBaseBranch = null;
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const repoInfo = await getRepository();
  const head = repoInfo.repo.state.HEAD;
  
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
 * Auto-detects common base branches or prompts user to select
 * Result is cached for the current PR generation session
 */
export async function getBaseBranch(currentBranch: string): Promise<string> {
  // Return cached base branch if available
  if (cachedBaseBranch) {
    return cachedBaseBranch;
  }
  
  // Try auto-detection first
  const autoDetected = await autoDetectBaseBranch();
  if (autoDetected) {
    vscode.window.showInformationMessage(
      `Auto-detected base branch: ${autoDetected}. Comparing commits with this branch.`
    );
    cachedBaseBranch = autoDetected;
    return autoDetected;
  }
  
  // Fall back to prompting user
  const selected = await promptBaseBranchSelection(currentBranch);
  cachedBaseBranch = selected;
  return selected;
}

/**
 * Auto-detect common base branches in priority order
 * Returns the first branch that exists
 */
async function autoDetectBaseBranch(): Promise<string | null> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  const refs = await repo.getRefs();
  
  // Priority order of common base branches
  const commonBases = [
    'origin/main',
    'origin/master', 
    'origin/develop',
    'main',
    'master',
    'develop'
  ];
  
  const availableRefs = new Set(refs.map((ref: any) => ref.name).filter(Boolean));
  
  for (const branch of commonBases) {
    if (availableRefs.has(branch)) {
      return branch;
    }
  }
  
  return null;
}

/**
 * Prompt user to select base branch
 */
async function promptBaseBranchSelection(currentBranch: string): Promise<string> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  const refs = await repo.getRefs();
  
  // Build list of available branches (exclude current branch and its remote)
  const branches: string[] = [];
  const currentBranchRemote = `origin/${currentBranch}`;
  
  // Add common remote branches (exclude current branch's remote tracking branch)
  const remoteBranches = refs.filter((ref: any) => 
    ref.name?.startsWith('origin/') && 
    !ref.name.includes('HEAD') &&
    ref.name !== currentBranchRemote
  ).map((ref: any) => ref.name);
  
  branches.push(...remoteBranches);
  
  // Add local branches (exclude current branch)
  const localBranches = refs.filter((ref: any) => 
    ref.type === 0 && // Head type
    !ref.name?.startsWith('origin/') &&
    ref.name !== currentBranch
  ).map((ref: any) => ref.name);
  
  branches.push(...localBranches);
  
  // Remove duplicates and sort (prioritize common base branches)
  const uniqueBranches = [...new Set(branches)].filter(Boolean);
  const commonBases = ['origin/main', 'origin/master', 'origin/develop', 'main', 'master', 'develop'];
  
  const sortedBranches = uniqueBranches.sort((a, b) => {
    const aIndex = commonBases.indexOf(a);
    const bIndex = commonBases.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
  
  if (sortedBranches.length === 0) {
    throw new Error('No other branches found to compare with. Please create or fetch other branches first.');
  }
  
  const result = await vscode.window.showQuickPick(
    sortedBranches.map(branch => ({
      label: `$(git-branch) ${branch}`,
      description: commonBases.includes(branch) ? '(common base branch)' : '',
      branch
    })),
    {
      placeHolder: `Select base branch to compare '${currentBranch}' with`,
      title: 'Select Base Branch for PR'
    }
  );
  
  if (!result) {
    throw new Error('Base branch selection was cancelled');
  }
  
  return result.branch;
}

/**
 * Get commit log from the current branch compared to base branch
 * @param baseBranch Base branch to compare against (optional, will auto-detect/prompt if not provided)
 * @param maxCommits Maximum number of commits to retrieve (default: 50)
 */
export async function getCommitLog(baseBranch?: string, maxCommits: number = 50): Promise<CommitInfo[]> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  
  try {
    // Get commits using range if baseBranch is provided
    const logOptions: any = {
      maxEntries: maxCommits
    };
    
    if (baseBranch) {
      // Use range syntax to get commits unique to current branch
      // This filters out commits from the base branch
      logOptions.range = `${baseBranch}..HEAD`;
    }
    
    const log = await repo.log(logOptions);
    
    if (log.length === 0) {
      if (baseBranch) {
        throw new Error(
          `No commits found between ${baseBranch} and current branch. ` +
          `This usually means:\n` +
          `1. You're on the base branch itself\n` +
          `2. All commits have been merged to the base branch\n` +
          `3. The branch comparison is incorrect`
        );
      }
      throw new Error('No commits found on the current branch.');
    }
    
    // Filter out merge commits and map to CommitInfo
    const commits: CommitInfo[] = log
      .filter((commit: any) => {
        const message = commit.message.split('\n')[0];
        // Exclude merge commits with common patterns
        return !(
          message.startsWith('Merge') ||
          message.startsWith('Merged in') ||
          message.startsWith('Merged PR') ||
          message.match(/^Merge (branch|pull request|remote-tracking branch)/i)
        );
      })
      .map((commit: any) => ({
        hash: commit.hash, // Store full hash for Git operations
        message: commit.message.split('\n')[0],
        body: commit.message.split('\n').slice(1).join('\n').trim() || undefined,
        author: commit.authorName || commit.authorEmail,
        date: new Date(commit.authorDate || commit.commitDate),
        files: [] // Files will be populated separately if needed
      }));
    
    if (commits.length === 0) {
      throw new Error('No non-merge commits found on the current branch.');
    }
    
    return commits;
  } catch (error: any) {
    throw new Error(
      `Failed to get commit log from current branch. ` +
      `Original error: ${error.message || error}`
    );
  }
}

/**
 * Get file changes from recent commits
 * Analyzes files changed across the commit history by examining each commit
 */
export async function getFileChanges(commits: CommitInfo[]): Promise<FileChange[]> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  
  if (commits.length === 0) {
    return [];
  }
  
  try {
    const fileMap = new Map<string, FileChange>();
    
    // Get all commits with their file changes
    for (const commitInfo of commits) {
      try {
        // Get the full commit object with parents
        const commit = await repo.getCommit(commitInfo.hash);
        
        if (commit && commit.parents && commit.parents.length > 0) {
          // Get diff between this commit and its parent
          const parentHash = commit.parents[0];
          const changes = await repo.diffBetween(parentHash, commit.hash);
          
          if (changes && changes.length > 0) {
            for (const change of changes) {
              if (change.uri?.fsPath) {
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
                
                // Use the most recent status for each file
                fileMap.set(change.uri.fsPath, {
                  path: change.uri.fsPath,
                  status,
                  additions: 0,  // VS Code Git API doesn't provide these
                  deletions: 0,
                  oldPath
                });
              }
            }
          }
        }
      } catch (commitError) {
        // Skip commits that can't be diffed (e.g., initial commit with no parent)
        // This is normal for the first commit in a repository
        continue;
      }
    }
    
    const fileChanges = Array.from(fileMap.values());
    
    if (fileChanges.length === 0) {
      console.warn(`No file changes detected across ${commits.length} commit(s). This might indicate an issue with commit analysis.`);
    }
    
    return fileChanges;
  } catch (error) {
    // If getting file changes fails completely, return empty array
    console.warn('Could not get file changes:', error);
    return [];
  }
}

/**
 * Get file changes efficiently by comparing base branch to HEAD
 * This is more efficient than analyzing each commit individually
 * @param baseBranch Base branch to compare against
 */
export async function getFileChangesSinceBase(baseBranch: string): Promise<FileChange[]> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  
  try {
    // Get diff between base branch and current HEAD
    const changes = await repo.diffBetween(baseBranch, 'HEAD');
    
    if (!changes || changes.length === 0) {
      return [];
    }
    
    const fileChanges: FileChange[] = changes
      .filter((change: any) => change.uri?.fsPath)
      .map((change: any) => {
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
          path: change.uri!.fsPath,
          status,
          additions: 0,  // VS Code Git API doesn't provide these
          deletions: 0,
          oldPath
        };
      });
    
    return fileChanges;
  } catch (error) {
    console.warn('Could not get file changes since base:', error);
    return [];
  }
}

/**
 * Get detailed diff for a specific file
 */
export async function getFileDiff(
  filePath: string,
  baseBranch: string
): Promise<string> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  const currentBranch = await getCurrentBranch();
  
  // Get diff content
  const diff = await repo.diffWith(baseBranch, filePath);
  return diff || '';
}

/**
 * Check if working directory is clean
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  const changes = repo.state.workingTreeChanges;
  const indexChanges = repo.state.indexChanges;
  
  return changes.length === 0 && indexChanges.length === 0;
}

/**
 * Get remote URL for the repository
 */
export async function getRemoteUrl(): Promise<string | null> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
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
export async function getRepositoryRoot(): Promise<string> {
  const repoInfo = await getRepository();
  return repoInfo.cwd;
}

/**
 * Check if a branch exists locally
 */
export async function branchExists(branchName: string): Promise<boolean> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  const refs = await repo.getRefs();
  
  return refs.some((ref: any) => ref.name === branchName);
}

/**
 * Check if a branch exists on remote
 */
export async function remoteBranchExists(branchName: string): Promise<boolean> {
  const repoInfo = await getRepository();
  const repo = repoInfo.repo;
  const refs = await repo.getRefs();
  
  return refs.some((ref: any) => 
    ref.name === `origin/${branchName}` || ref.name === `refs/remotes/origin/${branchName}`
  );
}
