import { DomainError } from '@core/domain/domain.error';
import { Issue } from './issue.entity';

const local = () =>
  Issue.createLocal({
    name: 'Tarea',
    description: null,
    projectId: 'p1',
    localSequence: 1,
  });

const fromPlane = () =>
  Issue.reconstruct({
    id: 'i1',
    name: 'Ticket',
    isLocal: false,
    externalId: 'ext-1',
    externalState: 'Todo',
    remoteSequence: 7,
    localSequence: 1,
    description: null,
    priority: 'high',
    stateId: null,
    projectId: 'p1',
    labelIds: [],
    startDate: null,
    dueDate: null,
    estimatedHours: null,
    closedAt: null,
    syncedAt: new Date(),
    createdAt: new Date(),
  });

describe('Issue', () => {
  describe('local issue', () => {
    it('edits priority, dates, hours and labels', () => {
      const issue = local();
      issue.setPriority('urgent');
      issue.setDates({ startDate: '2026-10-01', dueDate: '2026-10-10' });
      issue.setEstimatedHours(3.5);
      issue.setLabels(['l1', 'l1', 'l2']);

      expect(issue.priority).toBe('urgent');
      expect(issue.startDate).toBe('2026-10-01');
      expect(issue.dueDate).toBe('2026-10-10');
      expect(issue.estimatedHours).toBe(3.5);
      expect(issue.labelIds).toEqual(['l1', 'l2']);
    });

    it('rejects an unknown priority', () => {
      expect(() => local().setPriority('critical')).toThrow(DomainError);
    });

    it('moves both dates to a later period in one call', () => {
      const issue = local();
      issue.setDates({ startDate: '2026-10-01', dueDate: '2026-10-05' });
      issue.setDates({ startDate: '2026-11-01', dueDate: '2026-11-05' });
      expect(issue.startDate).toBe('2026-11-01');
    });

    it('keeps the previous dates when the new range is invalid', () => {
      const issue = local();
      issue.setDates({ startDate: '2026-10-01', dueDate: '2026-10-05' });
      expect(() => issue.setDates({ startDate: '2026-12-01' })).toThrow(
        DomainError,
      );
      expect(issue.startDate).toBe('2026-10-01');
    });

    it('rejects malformed dates and negative hours', () => {
      expect(() => local().setDates({ dueDate: '10/10/2026' })).toThrow(
        DomainError,
      );
      expect(() => local().setEstimatedHours(-1)).toThrow(DomainError);
    });
  });

  describe('Plane issue', () => {
    it('cannot change the fields that the sync overwrites', () => {
      const issue = fromPlane();
      expect(() => issue.rename('Otro')).toThrow(DomainError);
      expect(() => issue.updateDescription('x')).toThrow(DomainError);
      expect(() => issue.setPriority('low')).toThrow(DomainError);
      expect(() => issue.setDates({ dueDate: '2026-10-10' })).toThrow(
        DomainError,
      );
      expect(() => issue.changeProject('p2')).toThrow(DomainError);
    });

    it('can still change state, labels and estimated hours', () => {
      const issue = fromPlane();
      issue.setState('s1');
      issue.setLabels(['l1']);
      issue.setEstimatedHours(2);
      expect(issue.stateId).toBe('s1');
      expect(issue.labelIds).toEqual(['l1']);
      expect(issue.estimatedHours).toBe(2);
    });
  });

  describe('Plane estimate', () => {
    const remote = {
      name: 'Ticket',
      description: null,
      externalState: 'Todo',
      priority: 'high',
      remoteSequence: 7,
      startDate: null,
      dueDate: null,
    };

    it('fills the estimated hours with the estimate that Plane sends', () => {
      const issue = fromPlane();
      issue.syncFromRemote({ ...remote, estimatedHours: 3 });
      expect(issue.estimatedHours).toBe(3);
    });

    it('keeps the local estimated hours when Plane has no estimate', () => {
      const issue = fromPlane();
      issue.setEstimatedHours(5);
      issue.syncFromRemote({ ...remote, estimatedHours: null });
      expect(issue.estimatedHours).toBe(5);
    });
  });
});
