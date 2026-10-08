import { DomainError } from '@core/domain/domain.error';
import { IssueTransferService } from './issue-transfer.service';

const issue = (over: Record<string, unknown>) => ({
  isLocal: true,
  stateId: null,
  ...over,
});

function setup(source: unknown, target: unknown) {
  const tasks = {
    findIssue: jest.fn((id: string) =>
      Promise.resolve(id === 'src' ? source : id === 'dst' ? target : null),
    ),
    setIssueState: jest.fn().mockResolvedValue(undefined),
    deleteIssue: jest.fn().mockResolvedValue(undefined),
  };
  const timeEntries = { moveEntries: jest.fn().mockResolvedValue(3) };
  const boards = { reassignIssue: jest.fn().mockResolvedValue(undefined) };
  const service = new IssueTransferService(
    tasks as never,
    timeEntries as never,
    boards as never,
  );
  return { service, tasks, timeEntries, boards };
}

describe('IssueTransferService', () => {
  it('moves hours and state to the target and deletes the local issue', async () => {
    const { service, tasks, timeEntries } = setup(
      issue({ stateId: 's1' }),
      issue({ isLocal: false }),
    );

    await expect(service.transfer('src', 'dst')).resolves.toBe(3);

    expect(timeEntries.moveEntries).toHaveBeenCalledWith('src', 'dst');
    expect(tasks.setIssueState).toHaveBeenCalledWith('dst', 's1');
    expect(tasks.deleteIssue).toHaveBeenCalledWith('src');
  });

  it('keeps the target state when the local issue has none', async () => {
    const { service, tasks } = setup(issue({}), issue({ isLocal: false }));

    await service.transfer('src', 'dst');

    expect(tasks.setIssueState).not.toHaveBeenCalled();
  });

  it('rejects a source that is not local', async () => {
    const { service, timeEntries } = setup(
      issue({ isLocal: false }),
      issue({ isLocal: false }),
    );

    await expect(service.transfer('src', 'dst')).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(timeEntries.moveEntries).not.toHaveBeenCalled();
  });

  it('rejects a local target', async () => {
    const { service, tasks } = setup(issue({}), issue({}));

    await expect(service.transfer('src', 'dst')).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(tasks.deleteIssue).not.toHaveBeenCalled();
  });

  it('rejects a missing target and transferring to itself', async () => {
    const { service } = setup(issue({}), null);

    await expect(service.transfer('src', 'dst')).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(service.transfer('src', 'src')).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('does not delete the local issue nor move hours when the state change fails', async () => {
    const { service, tasks, timeEntries } = setup(
      issue({ stateId: 's1' }),
      issue({ isLocal: false }),
    );
    tasks.setIssueState.mockRejectedValue(new Error('boom'));

    await expect(service.transfer('src', 'dst')).rejects.toThrow('boom');

    expect(timeEntries.moveEntries).not.toHaveBeenCalled();
    expect(tasks.deleteIssue).not.toHaveBeenCalled();
  });

  it('moves the board card to the target before deleting the local issue', async () => {
    const { service, tasks, boards } = setup(
      issue({ stateId: 's1' }),
      issue({ isLocal: false }),
    );
    const order: string[] = [];
    tasks.setIssueState.mockImplementation(() => {
      order.push('state');
      return Promise.resolve();
    });
    boards.reassignIssue.mockImplementation(() => {
      order.push('board');
      return Promise.resolve();
    });
    tasks.deleteIssue.mockImplementation(() => {
      order.push('delete');
      return Promise.resolve();
    });

    await service.transfer('src', 'dst');

    expect(boards.reassignIssue).toHaveBeenCalledWith('src', 'dst');
    expect(order).toEqual(['state', 'board', 'delete']);
  });

  it('does not delete the local issue when moving the board card fails', async () => {
    const { service, tasks, boards } = setup(
      issue({}),
      issue({ isLocal: false }),
    );
    boards.reassignIssue.mockRejectedValue(new Error('boom'));

    await expect(service.transfer('src', 'dst')).rejects.toThrow('boom');

    expect(tasks.deleteIssue).not.toHaveBeenCalled();
  });

  it('does not delete the local issue when moving the hours fails', async () => {
    const { service, tasks, timeEntries } = setup(
      issue({}),
      issue({ isLocal: false }),
    );
    timeEntries.moveEntries.mockRejectedValue(new Error('boom'));

    await expect(service.transfer('src', 'dst')).rejects.toThrow('boom');

    expect(tasks.deleteIssue).not.toHaveBeenCalled();
  });
});
