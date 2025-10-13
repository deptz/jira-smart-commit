
import fetch from 'node-fetch';
import { JiraIssue } from './types';

type Params = { key: string; baseUrl: string; email: string; apiToken: string; fetchRelatedIssues?: boolean };

export async function fetchIssue({ key, baseUrl, email, apiToken, fetchRelatedIssues = false }: Params): Promise<JiraIssue> {
  if (!baseUrl || !email || !apiToken) {
    throw new Error('Missing JIRA configuration (baseUrl, email, apiToken).');
  }
  
  // Debug logging
  console.log('[JIRA Client] Fetching issue with config:', {
    key,
    baseUrl,
    email: email.substring(0, 3) + '***', // Partial email for privacy
    hasToken: !!apiToken
  });
  
  const authHeader = 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64');
  const normalizedBase = baseUrl.replace(/\/$/, '');
  
  // Try API v3 first (JIRA Cloud), then fall back to v2 (JIRA Server/older instances)
  const apiVersions = ['3', '2'];
  let lastError: Error | null = null;
  
  for (const apiVersion of apiVersions) {
    // Conditionally expand issuelinks, subtasks, and parent based on fetchRelatedIssues
    const expandParam = fetchRelatedIssues 
      ? 'expand=renderedFields,issuelinks,subtasks,parent'
      : 'expand=renderedFields';
    const url = `${normalizedBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(key)}?${expandParam}`;
    
    console.log(`[JIRA Client] Attempting ${url}`);
    
    let res;
    try {
      res = await fetch(url, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
    } catch (err) {
      lastError = new Error(`Network error connecting to JIRA at ${url}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      lastError = new Error(`JIRA API error ${res.status} at ${url}: ${text}`);
      // If 404, try the next API version
      if (res.status === 404 && apiVersion !== apiVersions[apiVersions.length - 1]) {
        continue;
      }
      throw lastError;
    }
    
    // Success! Parse and return
    const data = await res.json();
    return parseJiraIssue(key, data, fetchRelatedIssues);
  }
  
  // If we get here, all API versions failed
  throw lastError || new Error('Failed to fetch JIRA issue');
}

function parseJiraIssue(key: string, data: any, fetchRelatedIssues: boolean = false): JiraIssue {
  const summary = data.fields?.summary ?? '';
  const description = unwrapDescription(data.fields?.description);
  const acceptance = extractAcceptance(description);
  
  // Only fetch related keys if the option is enabled
  const relatedKeys = fetchRelatedIssues ? [
    ...((data.fields?.subtasks ?? []).map((s: any) => s.key)),
    ...(extractLinkedKeys(data.fields?.issuelinks ?? [])),
    ...(data.fields?.parent?.key ? [data.fields.parent.key] : [])
  ] : [];

  return { key, summary, description, acceptance, relatedKeys };
}

function unwrapDescription(desc: any): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  try {
    const text = (desc.content ?? [])
      .flatMap((b: any) => (b.content ?? []).map((n: any) => n.text))
      .filter(Boolean)
      .join('\\n');
    return text || '';
  } catch {
    return '';
  }
}

function extractAcceptance(description: string): string[] {
  const out: string[] = [];
  const lines = description.split(/\\r?\\n/);
  let inBlock = false;
  for (const l of lines) {
    if (/acceptance\\s*criteria/i.test(l)) { inBlock = true; continue; }
    if (inBlock && /^\\s*[-*]\\s+/.test(l)) out.push(l.replace(/^\\s*[-*]\\s+/, '').trim());
    else if (inBlock && /^\\S/.test(l)) break;
  }
  return out.slice(0, 6);
}

function extractLinkedKeys(links: any[]): string[] {
  const keys = new Set<string>();
  for (const l of links) {
    const inw = l.inwardIssue?.key;
    const outw = l.outwardIssue?.key;
    if (inw) keys.add(inw);
    if (outw) keys.add(outw);
  }
  return [...keys];
}
