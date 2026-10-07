import { Logger } from '@nestjs/common';

export interface WorkQueueOptions<T> {
  /** Nombre para los logs (ej. `ReviewsService`). */
  name: string;
  /** Cuántos elementos se procesan a la vez. */
  concurrency: number;
  /** Toma el siguiente elemento pendiente (marcándolo como tomado) o `null` si no hay. */
  claim: () => Promise<T | null>;
  /** Procesa un elemento ya tomado. Debe registrar sus propios fallos: si lanza, el worker cae. */
  process: (item: T) => Promise<void>;
}

/**
 * Workers en proceso sobre una cola que vive en la base de datos (el reclamo atómico lo hace
 * `claim`). Quien encola no procesa: solo llama a `kick()`, que despierta a los workers libres.
 */
export class WorkQueue<T> {
  private readonly logger: Logger;
  private active = 0;
  private rekick = false;

  constructor(private readonly options: WorkQueueOptions<T>) {
    this.logger = new Logger(options.name);
  }

  get activeWorkers(): number {
    return this.active;
  }

  get concurrency(): number {
    return this.options.concurrency;
  }

  kick(): void {
    if (this.active >= this.options.concurrency) {
      // Todos los workers están ocupados; que revisen la cola otra vez al terminar.
      this.rekick = true;
      return;
    }

    while (this.active < this.options.concurrency) {
      this.active++;
      void this.runWorker();
    }
  }

  private async runWorker(): Promise<void> {
    try {
      for (;;) {
        this.rekick = false;
        const item = await this.options.claim();

        if (!item) {
          // Si alguien encoló mientras consultábamos, damos otra vuelta.
          if (this.rekick) continue;
          return;
        }

        await this.options.process(item);
      }
    } catch (error) {
      this.logger.error(
        `Worker crashed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.active--;
    }
  }
}
