
import { DiffSummary } from './diffAnalyzer';
import { JiraIssue } from './types';
import { Config } from './utils';

export function renderTemplate(args: {
  cfg: Config;
  diff: DiffSummary;
  issue?: JiraIssue;
  meta: { type: string; scope: string; breaking: boolean };
}): string {
  const { cfg, diff, issue, meta } = args;
  const bullets = toBullets(diff);
  const accBullets = (issue?.acceptance ?? []).map(b => `- ${b}`).join('\n');
  const scope = meta.scope ? `(${meta.scope})` : '';
  const typePrefix = meta.type ? `${meta.type}${scope}: ` : '';
  const oneLineDesc = (issue?.description ?? '').split(/\r?\n/).filter(Boolean)[0]?.slice(0, 140) ?? '';

  // Default template follows Conventional Commits 1.0.0 specification:
  // <type>[optional scope]: <description>
  // 
  // [optional body]
  // 
  // [optional footer(s)]
  // 
  // The body should contain a brief explanation of the changes.
  // Optionally include JIRA details if configured.
  let defaultTemplate = `${typePrefix}\${jira.summary}

\${changes.bullets}`;

  // Optionally add JIRA description and acceptance criteria if enabled
  if (cfg.includeJiraDetailsInBody) {
    defaultTemplate += `

\${jira.oneLineDescription}

Acceptance criteria:
\${jira.acceptanceBullets}`;
  }

  const base = cfg.commitTemplate || defaultTemplate;

  return base
    .replace(/\$\{jira\.summary\}/g, issue?.summary ?? '(no JIRA summary)')
    .replace(/\$\{changes\.bullets\}/g, bullets || '- (no staged changes summary)')
    .replace(/\$\{jira\.oneLineDescription\}/g, oneLineDesc || '(no description)')
    .replace(/\$\{jira\.acceptanceBullets\}/g, accBullets || '- (not provided)')
    .replace(/\$\{type\}/g, meta.type || '')
    .replace(/\$\{scope\}/g, scope);
}

function toBullets(diff: DiffSummary): string {
  if (!diff.files.length) return '';
  const items = diff.files.slice(0, 40).map(f => {
    // Follow Conventional Commits spec - no emojis, just status and path
    const statusLabel = f.status === 'A' ? 'Added' : f.status === 'D' ? 'Deleted' : f.status === 'M' ? 'Modified' : f.status;
    return `- ${statusLabel}: ${f.path}`;
  });

  if (diff.hasMigrations) items.push('- Database migrations detected');
  if (diff.deletedPublicApis.length) items.push(`- Deleted files: ${diff.deletedPublicApis.slice(0, 10).join(', ')}`);
  return items.join('\n');
}
