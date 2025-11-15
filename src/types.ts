
export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  acceptance: string[];
  relatedKeys: string[];
  testCases?: string;  // Optional test cases field for PR descriptions
  issueType?: string;  // Issue type (e.g., Task, Bug, Story)
};
