import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { Recipe } from '../models/recipe';
import { RecipesApi } from './recipes.api';
import { RecipesStore } from './recipes.store';

const recipe = (repo: string, extra: Partial<Recipe> = {}): Recipe => ({
  id: `id-${repo}`,
  repo,
  content: 'texto',
  dependsOn: [],
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
  ...extra,
});

describe('RecipesStore', () => {
  let api: Record<
    'list' | 'repositories' | 'create' | 'update' | 'remove',
    ReturnType<typeof vi.fn>
  >;
  let store: RecipesStore;
  let toast: Toast;

  beforeEach(() => {
    api = {
      list: vi.fn(() => of([recipe('acme/web'), recipe('acme/app')])),
      repositories: vi.fn(() =>
        of([
          { repo: 'acme/app', labels: ['app'] },
          { repo: 'acme/web', labels: ['flota', 'web'] },
          { repo: 'acme/db', labels: ['db'] },
        ]),
      ),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [RecipesStore, { provide: RecipesApi, useValue: api }],
    });
    store = TestBed.inject(RecipesStore);
    toast = TestBed.inject(Toast);
  });

  it('loads the recipes and knows which repositories have one', async () => {
    await store.load();

    expect(store.recipes().map((item) => item.repo)).toEqual(['acme/web', 'acme/app']);
    expect(store.repos()).toEqual(['acme/web', 'acme/app']);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('loads the repositories that the labels point to, and says which labels use each one', async () => {
    await store.load();

    expect(store.options().map((option) => option.repo)).toEqual([
      'acme/app',
      'acme/web',
      'acme/db',
    ]);
    expect(store.labelsOf('acme/web')).toEqual(['flota', 'web']);
    expect(store.labelsOf('Acme/Web')).toEqual(['flota', 'web']);
    expect(store.labelsOf('acme/otro')).toEqual([]);
  });

  it('still loads the recipes when the repositories of the labels cannot be read', async () => {
    api.repositories.mockReturnValue(throwError(() => new Error('falló')));

    await store.load();

    expect(store.recipes()).toHaveLength(2);
    expect(store.options()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('keeps the error when it cannot load', async () => {
    api.list.mockReturnValue(throwError(() => new Error('sin conexión')));

    await store.load();

    expect(store.error()).toBeTruthy();
    expect(store.loaded()).toBe(false);
  });

  it('adds a new recipe in its place by repository', async () => {
    await store.load();
    api.create.mockReturnValue(of(recipe('acme/api')));

    await store.save({ repo: 'acme/api', content: 'x', dependsOn: [] }, null);

    expect(api.create).toHaveBeenCalledWith({ repo: 'acme/api', content: 'x', dependsOn: [] });
    expect(store.repos()).toEqual(['acme/api', 'acme/web', 'acme/app'].sort());
  });

  it('updates an existing recipe without touching the repository', async () => {
    await store.load();
    const existing = store.recipes()[0];
    api.update.mockReturnValue(of({ ...existing, content: 'nuevo', dependsOn: ['acme/db'] }));

    await store.save({ repo: existing.repo, content: 'nuevo', dependsOn: ['acme/db'] }, existing);

    expect(api.update).toHaveBeenCalledWith(existing.id, {
      content: 'nuevo',
      dependsOn: ['acme/db'],
    });
    expect(store.recipes().find((item) => item.id === existing.id)?.content).toBe('nuevo');
    expect(store.recipes()).toHaveLength(2);
  });

  it('lets the error of a failed save reach the dialog, so it stays open', async () => {
    api.create.mockReturnValue(throwError(() => new Error('There is already a recipe')));

    await expect(
      store.save({ repo: 'acme/web', content: 'x', dependsOn: [] }, null),
    ).rejects.toThrow('already');
  });

  it('removes a recipe, and tells the user when it cannot', async () => {
    await store.load();
    const first = store.recipes()[0];

    expect(await store.remove(first)).toBe(true);
    expect(store.recipes()).toHaveLength(1);

    api.remove.mockReturnValue(throwError(() => new Error('falló')));
    const error = vi.spyOn(toast, 'error');
    expect(await store.remove(store.recipes()[0])).toBe(false);
    expect(error).toHaveBeenCalled();
    expect(store.recipes()).toHaveLength(1);
  });
});
