export interface IssueExistsPort {
  exists(issueId: string): Promise<boolean>;
}

export const ISSUE_EXISTS_PORT = Symbol('IssueExistsPort');
