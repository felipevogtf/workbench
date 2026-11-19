import { DomainError } from '@core/domain/domain.error';
import { TaskProject } from './task-project.entity';

const plane = () =>
  TaskProject.createFromExternal({
    name: 'Melón',
    externalId: 'ext-1',
    source: 'plane',
    identifier: 'MEL',
  });

describe('Project configuration', () => {
  it('a Plane project syncs and is visible by default', () => {
    const project = plane();
    expect(project.syncEnabled).toBe(true);
    expect(project.visible).toBe(true);
  });

  it('lets a Plane project turn the sync and the visibility on and off', () => {
    const project = plane();
    project.configure({ syncEnabled: false, visible: false });
    expect(project.syncEnabled).toBe(false);
    expect(project.visible).toBe(false);
    project.configure({ visible: true });
    expect(project.visible).toBe(true);
    expect(project.syncEnabled).toBe(false);
  });

  it('a Plane project still cannot be renamed by hand', () => {
    expect(() => plane().rename('Otro')).toThrow(DomainError);
  });

  it('a local project is visible, can be hidden, but has no sync to turn on', () => {
    const local = TaskProject.createLocal({ name: 'Local' });
    expect(local.visible).toBe(true);
    local.configure({ visible: false });
    expect(local.visible).toBe(false);
    expect(() => local.configure({ syncEnabled: true })).toThrow(DomainError);
  });

  describe('default projects', () => {
    it('are empty at first and can be set on a Plane project too', () => {
      const project = TaskProject.createFromExternal({
        name: 'Melón',
        externalId: 'e1',
        source: 'plane',
        identifier: 'MEL',
      });
      expect(project.defaultProjectRepos).toEqual([]);

      project.configure({
        defaultProjectRepos: [' Acme/Web ', 'acme/api', 'acme/web'],
      });

      expect(project.defaultProjectRepos).toEqual(['acme/web', 'acme/api']);
    });

    it('reject a repository that is not organization/repository and more than three', () => {
      const project = TaskProject.createLocal({ name: 'Local' });

      expect(() =>
        project.configure({ defaultProjectRepos: ['sin-org'] }),
      ).toThrow(DomainError);
      expect(() =>
        project.configure({
          defaultProjectRepos: ['a/1', 'a/2', 'a/3', 'a/4'],
        }),
      ).toThrow(DomainError);
    });
  });
});
