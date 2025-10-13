
export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  acceptance: string[];
  relatedKeys: string[];
};
