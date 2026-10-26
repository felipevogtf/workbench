import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { Label } from '@tasks/domain/entities/label.entity';
import { TasksRepositoryOptionsAdapter } from './tasks-repository-options.adapter';

const label = (name: string, repoUrl: string | null) =>
  Label.reconstruct({ id: name, name, color: '#000000', repoUrl });

const adapterWith = (labels: Label[]) =>
  new TasksRepositoryOptionsAdapter({
    findAllLabels: () => Promise.resolve(labels),
  } as unknown as TasksFacade);

describe('TasksRepositoryOptionsAdapter', () => {
  it('turns the link of each label into organization/repo, with the labels that use it', async () => {
    const options = await adapterWith([
      label('web', 'https://bitbucket.org/garage-labs/miflota-web'),
      label('flota', 'https://bitbucket.org/Garage-Labs/MiFlota-Web.git'),
      label('app', 'https://github.com/garage-labs/miflota-app'),
    ]).list();

    expect(options).toEqual([
      { repo: 'garage-labs/miflota-app', labels: ['app'] },
      { repo: 'garage-labs/miflota-web', labels: ['flota', 'web'] },
    ]);
  });

  it('skips the labels without a repository link, or with one that is not organization/repo', async () => {
    const options = await adapterWith([
      label('bug', null),
      label('raro', 'https://bitbucket.org/solo-uno'),
      label('roto', 'no es un enlace'),
      label('ok', 'https://github.com/acme/web'),
    ]).list();

    expect(options).toEqual([{ repo: 'acme/web', labels: ['ok'] }]);
  });

  it('is empty when no label points to a repository', async () => {
    expect(await adapterWith([label('bug', null)]).list()).toEqual([]);
  });
});
