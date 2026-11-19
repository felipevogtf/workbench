import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { Label } from '@tasks/domain/entities/label.entity';
import { TasksRepositoryOptionsAdapter } from './tasks-repository-options.adapter';

const label = (name: string, projectRepo: string | null) =>
  Label.reconstruct({ id: name, name, color: '#000000', projectRepo });

const adapterWith = (labels: Label[]) =>
  new TasksRepositoryOptionsAdapter({
    findAllLabels: () => Promise.resolve(labels),
  } as unknown as TasksFacade);

describe('TasksRepositoryOptionsAdapter', () => {
  it('groups the labels by the project they point to', async () => {
    const options = await adapterWith([
      label('web', 'garage-labs/miflota-web'),
      label('flota', 'garage-labs/miflota-web'),
      label('app', 'garage-labs/miflota-app'),
    ]).list();

    expect(options).toEqual([
      { repo: 'garage-labs/miflota-app', labels: ['app'] },
      { repo: 'garage-labs/miflota-web', labels: ['flota', 'web'] },
    ]);
  });

  it('skips the labels that point to no project', async () => {
    const options = await adapterWith([
      label('bug', null),
      label('ok', 'acme/web'),
    ]).list();

    expect(options).toEqual([{ repo: 'acme/web', labels: ['ok'] }]);
  });

  it('is empty when no label points to a project', async () => {
    expect(await adapterWith([label('bug', null)]).list()).toEqual([]);
  });
});
