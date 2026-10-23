/**
 * Deja correr hasta `limit` tareas a la vez; las demás esperan su turno en orden de llegada.
 * Sirve para no lanzar más procesos pesados (como el CLI de IA) de los que la máquina aguanta.
 */
export class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    // El turno se cede tal cual (sin liberar y volver a tomar) para que nadie se cuele.
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
  }
}
