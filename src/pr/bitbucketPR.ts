import * as vscode from 'vscode';
import { getBitbucketConfigWithTeamDefaults } from '../aiConfigManager';
import {
  createBitbucketPullRequest,
  isBitbucketAuthError,
  toBasicAuthHeader,
} from '../bitbucket/client';
import {
  getCurrentBranch,
  getBaseBranch,
  getRemoteUrl,
  parseBitbucketUrl,
  getRepositoryRoot,
} from './gitOperations';
import { tryFetchJiraIssueFromBranch } from '../orchestrator/contextBuilders';
import { deleteTempPRDescriptionFile, readTempPRDescriptionFile } from './tempPRFile';

const BITBUCKET_SECRET_KEY = 'jiraSmartCommit.bitbucket.appPassword';
const JIRA_SECRET_KEY = 'jiraSmartCommit.jira.apiToken';

export interface CreateBitbucketPRResult {
  id: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
}

function deriveTitle(descriptionBody: string, fallback: { jiraKey?: string; sourceBranch: string }): string {
  const lines = descriptionBody.split(/\r?\n/).map((line) => line.trim());
  const firstContent = lines.find((line) => line.length > 0) || '';
  let candidate = firstContent.replace(/^#+\s*/, '').replace(/^\-\s*/, '').trim();
  if (!candidate) {
    candidate = fallback.jiraKey ? `${fallback.jiraKey}: ${fallback.sourceBranch}` : fallback.sourceBranch;
  }
  if (candidate.length > 120) {
    candidate = `${candidate.slice(0, 117)}...`;
  }
  return candidate;
}

async function promptBitbucketAppPassword(context: vscode.ExtensionContext): Promise<string> {
  const appPassword = await vscode.window.showInputBox({
    title: 'Enter Bitbucket App Password',
    password: true,
    ignoreFocusOut: true,
  });
  if (!appPassword) {
    throw new Error('Bitbucket app password is required to create pull request.');
  }
  await context.secrets.store(BITBUCKET_SECRET_KEY, appPassword);
  return appPassword;
}

async function resolveWorkspaceAndRepo(cwd: string, config: { workspace: string; repositorySlug: string }) {
  if (config.workspace && config.repositorySlug) {
    return { workspace: config.workspace, repositorySlug: config.repositorySlug };
  }

  const remote = await getRemoteUrl();
  if (!remote) {
    throw new Error(
      'Could not determine Bitbucket repository from git remote. Configure jiraSmartCommit.bitbucket.workspace and jiraSmartCommit.bitbucket.repositorySlug.'
    );
  }

  const parsed = parseBitbucketUrl(remote);
  if (!parsed) {
    throw new Error(
      'Remote URL is not a Bitbucket Cloud repository. Configure jiraSmartCommit.bitbucket.workspace and jiraSmartCommit.bitbucket.repositorySlug.'
    );
  }

  return {
    workspace: config.workspace || parsed.workspace,
    repositorySlug: config.repositorySlug || parsed.repo,
  };
}

export async function createBitbucketPRFromTempFile(options?: {
  cwd?: string;
  targetBranch?: string;
  autoOpen?: boolean;
}): Promise<CreateBitbucketPRResult> {
  const cwd = options?.cwd || (await getRepositoryRoot());
  const config = getBitbucketConfigWithTeamDefaults(cwd);
  if (!config.enabled) {
    throw new Error('Bitbucket PR creation is disabled. Enable jiraSmartCommit.bitbucket.enabled in settings.');
  }
  if (!config.email) {
    throw new Error('Bitbucket email is missing. Set jiraSmartCommit.bitbucket.email (or jiraSmartCommit.email).');
  }

  const sourceBranch = await getCurrentBranch();
  const fetchRelatedIssues = vscode.workspace.getConfiguration('jiraSmartCommit').get('fetchRelatedIssues', false) as boolean;
  const { jiraKey } = await tryFetchJiraIssueFromBranch(sourceBranch, fetchRelatedIssues);
  const targetBranch = options?.targetBranch || (await getBaseBranch(sourceBranch));

  const { workspace, repositorySlug } = await resolveWorkspaceAndRepo(cwd, config);
  const { body } = readTempPRDescriptionFile(cwd);
  const title = deriveTitle(body, { jiraKey, sourceBranch });

  const extensionContext = (global as any).extensionContext as vscode.ExtensionContext | undefined;
  if (!extensionContext) {
    throw new Error('Extension context is not available.');
  }

  const jiraToken = await extensionContext.secrets.get(JIRA_SECRET_KEY);
  let appPassword = await extensionContext.secrets.get(BITBUCKET_SECRET_KEY);

  const credentials: Array<{ password: string; source: string }> = [];
  if (config.authMode === 'jiraTokenThenAppPassword' && jiraToken) {
    credentials.push({ password: jiraToken, source: 'jira-token' });
  }
  if (config.authMode === 'appPasswordOnly' && !appPassword) {
    appPassword = await promptBitbucketAppPassword(extensionContext);
  }
  if (appPassword) {
    credentials.push({ password: appPassword, source: 'bitbucket-app-password' });
  }

  if (credentials.length === 0) {
    appPassword = await promptBitbucketAppPassword(extensionContext);
    credentials.push({ password: appPassword, source: 'bitbucket-app-password' });
  }

  let lastError: unknown;
  for (const credential of credentials) {
    try {
      const created = await createBitbucketPullRequest({
        authHeader: toBasicAuthHeader(config.email, credential.password),
        input: {
          workspace,
          repositorySlug,
          title,
          description: body,
          sourceBranch,
          targetBranch,
        },
      });

      if (credential.source === 'jira-token' && config.authMode === 'jiraTokenThenAppPassword') {
        // keep existing app password untouched; jira token worked
      }

      deleteTempPRDescriptionFile(cwd);

      if (options?.autoOpen ?? config.openAfterCreate) {
        await vscode.env.openExternal(vscode.Uri.parse(created.url));
      }

      return {
        ...created,
        sourceBranch,
        targetBranch,
        title,
      };
    } catch (error) {
      lastError = error;
      if (isBitbucketAuthError(error) && credential.source === 'jira-token') {
        if (!appPassword) {
          appPassword = await promptBitbucketAppPassword(extensionContext);
          credentials.push({ password: appPassword, source: 'bitbucket-app-password' });
        }
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
