import fetch from 'node-fetch';

export interface CreateBitbucketPRInput {
  workspace: string;
  repositorySlug: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface BitbucketPRResult {
  id: string;
  url: string;
}

export class BitbucketApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'BitbucketApiError';
  }
}

export function isBitbucketAuthError(error: unknown): boolean {
  return error instanceof BitbucketApiError && (error.status === 401 || error.status === 403);
}

export async function createBitbucketPullRequest(params: {
  authHeader: string;
  input: CreateBitbucketPRInput;
}): Promise<BitbucketPRResult> {
  const { authHeader, input } = params;
  const endpoint = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(input.workspace)}/${encodeURIComponent(
    input.repositorySlug
  )}/pullrequests`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      source: { branch: { name: input.sourceBranch } },
      destination: { branch: { name: input.targetBranch } },
    }),
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const message =
      (payload?.error?.message as string | undefined) ||
      `Bitbucket API request failed with status ${response.status}`;
    throw new BitbucketApiError(response.status, message);
  }

  const id = String(payload?.id ?? '');
  const url = String(payload?.links?.html?.href ?? '');
  if (!id || !url) {
    throw new Error('Bitbucket API response missing PR id/url.');
  }

  return { id, url };
}

export function toBasicAuthHeader(username: string, password: string): string {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${encoded}`;
}
