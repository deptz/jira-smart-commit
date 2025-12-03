import * as vscode from 'vscode';

/**
 * Prerequisite completion status for a branch
 */
interface PrerequisiteStatus {
  securityCompleted: boolean;
  testCoverageCompleted: boolean;
}

/**
 * Get the workspace state (Memento) from extension context
 */
function getWorkspaceState(): vscode.Memento | undefined {
  const context = (global as any).extensionContext as vscode.ExtensionContext | undefined;
  return context?.workspaceState;
}

/**
 * Get the storage key for a branch's prerequisites
 */
function getStorageKey(branchName: string): string {
  return `prPrerequisites:${branchName}`;
}

/**
 * Check if prerequisites are met for a branch
 * @param branchName The branch name to check
 * @returns Object with met status and list of missing prerequisites
 */
export async function checkPrerequisites(branchName: string): Promise<{ met: boolean; missing: string[] }> {
  const workspaceState = getWorkspaceState();
  if (!workspaceState) {
    // If no workspace state available, assume prerequisites are not met
    return { met: false, missing: ['Security Review', 'Test Coverage'] };
  }

  const key = getStorageKey(branchName);
  const status = workspaceState.get<PrerequisiteStatus>(key, {
    securityCompleted: false,
    testCoverageCompleted: false
  });

  const missing: string[] = [];
  if (!status.securityCompleted) {
    missing.push('Security Review');
  }
  if (!status.testCoverageCompleted) {
    missing.push('Test Coverage');
  }

  return {
    met: missing.length === 0,
    missing
  };
}

/**
 * Mark security review as completed for a branch
 * @param branchName The branch name
 */
export async function markSecurityCompleted(branchName: string): Promise<void> {
  const workspaceState = getWorkspaceState();
  if (!workspaceState) {
    console.warn('Cannot mark security as completed: workspace state not available');
    return;
  }

  const key = getStorageKey(branchName);
  const currentStatus = workspaceState.get<PrerequisiteStatus>(key, {
    securityCompleted: false,
    testCoverageCompleted: false
  });

  await workspaceState.update(key, {
    ...currentStatus,
    securityCompleted: true
  });
}

/**
 * Mark test coverage as completed for a branch
 * @param branchName The branch name
 */
export async function markTestCoverageCompleted(branchName: string): Promise<void> {
  const workspaceState = getWorkspaceState();
  if (!workspaceState) {
    console.warn('Cannot mark test coverage as completed: workspace state not available');
    return;
  }

  const key = getStorageKey(branchName);
  const currentStatus = workspaceState.get<PrerequisiteStatus>(key, {
    securityCompleted: false,
    testCoverageCompleted: false
  });

  await workspaceState.update(key, {
    ...currentStatus,
    testCoverageCompleted: true
  });
}


