// src/kanban/domain/ports/tasks-gateway.port.ts
export interface BoardIssueRef {
  id: string;
  stateId: string | null;
}

export interface TasksGatewayPort {
  issueExists(issueId: string): Promise<boolean>;
  findIssueRefsByIds(issueIds: string[]): Promise<BoardIssueRef[]>;
  setIssueState(issueId: string, stateId: string | null): Promise<void>;
  stateExists(stateId: string): Promise<boolean>;
}

export const TASKS_GATEWAY_PORT = Symbol('TasksGatewayPort');
