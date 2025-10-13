
import { promisify } from 'util';
import { exec as cpExec } from 'child_process';
const exec = promisify(cpExec);

export type FileChange = { path: string; status: 'A'|'M'|'D'|'R'|'C'; };
export type DiffSummary = {
  files: FileChange[];
  hasTestsChange: boolean;
  hasMigrations: boolean;
  deletedPublicApis: string[];
  fullDiff?: string; // Optional full diff content
};

export async function analyzeStaged(cwd?: string): Promise<DiffSummary> {
  const { stdout } = await exec('git diff --cached --name-status', { cwd });
  const files: FileChange[] = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [status, ...rest] = line.split(/\s+/);
      const path = rest.pop()!;
      return { status: status as any, path };
    });

  const hasTestsChange = files.some(f => /(^|\/)(test|__tests__|spec)\//i.test(f.path) || /\.(spec|test)\.[jt]sx?$/.test(f.path));
  const hasMigrations = files.some(f => /(^|\/)(migrations?|db\/migrate)\//i.test(f.path));
  const deletedPublicApis: string[] = [];

  const deletedFiles = files.filter(f => f.status === 'D' && /\.(ts|js|go|py|rb)$/.test(f.path));
  deletedPublicApis.push(...deletedFiles.map(f => f.path));

  // Get full diff content for potential inclusion in AI prompt
  let fullDiff: string | undefined;
  try {
    const { stdout: diffOutput } = await exec('git diff --cached', { cwd });
    fullDiff = diffOutput.trim();
  } catch (e) {
    // If getting full diff fails, just continue without it
    fullDiff = undefined;
  }

  return { files, hasTestsChange, hasMigrations, deletedPublicApis, fullDiff };
}
