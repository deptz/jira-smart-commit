
import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { JiraIssue } from './types';

// Shared output channel for logging
let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('JIRA Smart Commit');
  }
  return outputChannel;
}

type Params = { key: string; baseUrl: string; email: string; apiToken: string; fetchRelatedIssues?: boolean };

export async function fetchIssue({ key, baseUrl, email, apiToken, fetchRelatedIssues = false }: Params): Promise<JiraIssue> {
  if (!baseUrl || !email || !apiToken) {
    throw new Error('Missing JIRA configuration (baseUrl, email, apiToken).');
  }
  
  // Debug logging
  const logger = getOutputChannel();
  logger.appendLine(`[JIRA Client] Fetching issue: ${key}`);
  logger.appendLine(`  Base URL: ${baseUrl}`);
  logger.appendLine(`  Email: ${email.substring(0, 3)}***`);
  logger.appendLine(`  Has Token: ${!!apiToken}`);
  
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
    
    getOutputChannel().appendLine(`[JIRA Client] Attempting API v${apiVersion}: ${url}`);
    
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
  const issueType = data.fields?.issuetype?.name ?? '';
  
  // Only fetch related keys if the option is enabled
  const relatedKeys = fetchRelatedIssues ? [
    ...((data.fields?.subtasks ?? []).map((s: any) => s.key)),
    ...(extractLinkedKeys(data.fields?.issuelinks ?? [])),
    ...(data.fields?.parent?.key ? [data.fields.parent.key] : [])
  ] : [];

  return { key, summary, description, acceptance, relatedKeys, issueType };
}

/**
 * Recursively unwrap Atlassian Document Format (ADF) to plain text
 * Handles complex structures like tables, nested lists, and formatted text
 */
function unwrapDescription(desc: any): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  
  try {
    return processADFNode(desc).trim();
  } catch (error) {
    return '';
  }
}

/**
 * Process a single ADF node and return its text representation
 */
function processADFNode(node: any): string {
  if (!node) return '';
  
  const type = node.type;
  const content = node.content || [];
  
  switch (type) {
    case 'doc':
      return content.map(processADFNode).join('\n\n');
      
    case 'paragraph':
      return processInlineContent(content);
      
    case 'heading':
      const level = node.attrs?.level || 1;
      const headingText = processInlineContent(content);
      return '#'.repeat(level) + ' ' + headingText;
      
    case 'bulletList':
      return content.map((item: any) => '• ' + processADFNode(item)).join('\n');
      
    case 'orderedList':
      return content.map((item: any, idx: number) => `${idx + 1}. ` + processADFNode(item)).join('\n');
      
    case 'listItem':
      return content.map(processADFNode).join('\n');
      
    case 'table':
      return processTable(node);
      
    case 'tableRow':
      return content.map(processADFNode).join(' | ');
      
    case 'tableHeader':
    case 'tableCell':
      return content.map(processADFNode).join(' ');
      
    case 'rule':
      return '---';
      
    case 'codeBlock':
      const code = content.map((c: any) => c.text || '').join('');
      return '```\n' + code + '\n```';
      
    case 'blockquote':
      return content.map((c: any) => '> ' + processADFNode(c)).join('\n');
      
    case 'inlineCard':
      const url = node.attrs?.url || '';
      return url ? `[Link: ${url}]` : '';
      
    case 'mediaSingle':
    case 'media':
      return '[Media attachment]';
      
    case 'text':
      return applyTextMarks(node.text || '', node.marks);
      
    default:
      if (content.length > 0) {
        return content.map(processADFNode).join('');
      }
      return '';
  }
}

/**
 * Process inline content (text nodes with marks)
 */
function processInlineContent(content: any[]): string {
  return content.map(processADFNode).join('');
}

/**
 * Apply text formatting marks (bold, italic, code, etc.) as plain text indicators
 */
function applyTextMarks(text: string, marks?: any[]): string {
  if (!marks || marks.length === 0) return text;
  
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'strong':
        result = `**${result}**`;
        break;
      case 'em':
        result = `*${result}*`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'underline':
        result = `_${result}_`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'link':
        const href = mark.attrs?.href || '';
        result = href ? `${result} (${href})` : result;
        break;
    }
  }
  return result;
}

/**
 * Process table structure into readable plain text format
 */
function processTable(tableNode: any): string {
  const rows = tableNode.content || [];
  if (rows.length === 0) return '';
  
  const lines: string[] = [];
  lines.push('TABLE:');
  lines.push('─'.repeat(60));
  
  rows.forEach((row: any, rowIdx: number) => {
    const cells = row.content || [];
    const isHeader = cells.length > 0 && cells[0].type === 'tableHeader';
    
    const cellContents = cells.map((cell: any) => {
      const cellContent = (cell.content || [])
        .map(processADFNode)
        .join(' ')
        .trim();
      return cellContent || '(empty)';
    });
    
    if (isHeader) {
      lines.push('HEADER: ' + cellContents.join(' | '));
      lines.push('─'.repeat(60));
    } else {
      lines.push('ROW ' + rowIdx + ': ' + cellContents.join(' | '));
    }
  });
  
  lines.push('─'.repeat(60));
  return lines.join('\n');
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
