import { DomainError } from '@core/domain/domain.error';
import { Project } from './project.entity';

const plane = () =>
  Project.createFromExternal({
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
    const local = Project.createLocal({ name: 'Local' });
    expect(local.visible).toBe(true);
    local.configure({ visible: false });
    expect(local.visible).toBe(false);
    expect(() => local.configure({ syncEnabled: true })).toThrow(DomainError);
  });
});
