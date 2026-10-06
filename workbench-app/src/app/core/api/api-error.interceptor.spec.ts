import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from './api-error';
import { apiErrorInterceptor } from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  async function failWith(
    body: string | object,
    status: number,
    responseType: 'json' | 'text' = 'json',
  ): Promise<ApiError> {
    const result = new Promise<ApiError>((resolve) => {
      const request =
        responseType === 'text' ? http.get('/x', { responseType: 'text' }) : http.get('/x');
      request.subscribe({ error: (error: ApiError) => resolve(error) });
    });
    controller.expectOne('/x').flush(body, { status, statusText: 'Err' });
    return result;
  }

  it('uses the message sent by the backend', async () => {
    const error = await failWith({ statusCode: 409, message: 'Ya está en revisión' }, 409);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Ya está en revisión');
    expect(error.status).toBe(409);
    expect(error.isConflict).toBe(true);
  });

  it('joins a list of validation messages', async () => {
    const error = await failWith({ message: ['a', 'b'] }, 400);

    expect(error.message).toBe('a, b');
  });

  it('parses the JSON error body of text responses', async () => {
    const error = await failWith(JSON.stringify({ message: 'No hay revisión' }), 404, 'text');

    expect(error.message).toBe('No hay revisión');
    expect(error.isNotFound).toBe(true);
  });

  it('explains a network failure', async () => {
    const result = new Promise<ApiError>((resolve) =>
      http.get('/x').subscribe({ error: (error: ApiError) => resolve(error) }),
    );
    controller.expectOne('/x').error(new ProgressEvent('error'), { status: 0 });

    expect((await result).message).toBe('No se pudo conectar con el servidor');
  });
});
