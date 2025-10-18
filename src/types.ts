
export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  acceptance: string[];
  relatedKeys: string[];
  testCases?: string;  // Optional test cases field for PR descriptions
};
