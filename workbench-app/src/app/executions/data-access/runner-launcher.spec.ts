import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { runner } from '../testing/factories';
import { ExecutionsApi } from './executions.api';
import { RUNNER_START_URL, RUNNER_WAIT_MS, RunnerLauncher } from './runner-launcher';

describe('RunnerLauncher', () => {
  let api: { listRunners: ReturnType<typeof vi.fn> };
  let launcher: RunnerLauncher;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = { listRunners: vi.fn() };
    TestBed.configureTestingModule({
      providers: [RunnerLauncher, { provide: ExecutionsApi, useValue: api }],
    });
    launcher = TestBed.inject(RunnerLauncher);
    open = vi
      .spyOn(launcher as unknown as { open(url: string): void }, 'open')
      .mockImplementation(() => undefined);
  });

  afterEach(() => vi.useRealTimers());

  it('does nothing when a runner is already connected', async () => {
    api.listRunners.mockReturnValue(of([runner('a', { online: true })]));

    expect(await launcher.ensureOnline()).toBe('connected');
    expect(open).not.toHaveBeenCalled();
  });

  it('says so when there is no runner at all, without trying to open anything', async () => {
    api.listRunners.mockReturnValue(of([]));

    expect(await launcher.ensureOnline()).toBe('no-runners');
    expect(open).not.toHaveBeenCalled();
  });

  it('asks Windows to open the runner and waits until it connects', async () => {
    api.listRunners
      .mockReturnValueOnce(of([runner('a', { online: false })]))
      .mockReturnValueOnce(of([runner('a', { online: false })]))
      .mockReturnValue(of([runner('a', { online: true })]));

    const result = launcher.ensureOnline();
    await vi.advanceTimersByTimeAsync(5000);

    expect(await result).toBe('connected');
    expect(open).toHaveBeenCalledWith(RUNNER_START_URL);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('gives up after a while when the runner never connects', async () => {
    api.listRunners.mockReturnValue(of([runner('a', { online: false })]));

    const result = launcher.ensureOnline();
    await vi.advanceTimersByTimeAsync(RUNNER_WAIT_MS + 3000);

    expect(await result).toBe('timeout');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting through a failed poll', async () => {
    api.listRunners
      .mockReturnValueOnce(of([runner('a', { online: false })]))
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValue(of([runner('a', { online: true })]));

    const result = launcher.ensureOnline();
    await vi.advanceTimersByTimeAsync(6000);

    expect(await result).toBe('connected');
  });

  it('leaves the decision to the server when the runners cannot be listed', async () => {
    api.listRunners.mockReturnValue(throwError(() => new Error('sin red')));

    expect(await launcher.ensureOnline()).toBe('connected');
    expect(open).not.toHaveBeenCalled();
  });
});
