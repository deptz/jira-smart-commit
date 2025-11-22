
export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  acceptance: string[];
  relatedKeys: string[];
  testCases?: string;  // Optional test cases field for PR descriptions
  issueType?: string;  // Issue type (e.g., Task, Bug, Story)
};

/**
 * Usage metadata sent to team gateway for analytics tracking
 * Schema version 1.0 - new optional fields may be added without version bump
 */
export type UsageMetadata = {
  metadataVersion: '1.0';
  feature: 'commit' | 'pr' | 'firstPrompt';
  user: string; // Email or SHA-256 hash if anonymized
  timestamp: string; // ISO 8601 format
  requestId: string; // UUID
  jiraKey?: string;
  repository?: string;
  branch?: string;
  // Feature-specific optional fields
  commitsAnalyzed?: number;
  filesChanged?: number;
  language?: string;
  coverageDetected?: boolean;
  issueType?: string;
  templateType?: 'task' | 'bug';
};
