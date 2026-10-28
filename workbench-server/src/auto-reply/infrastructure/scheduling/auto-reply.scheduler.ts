import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { IncomingMessagesService } from '@auto-reply/application/incoming-messages.service';
import { RepliesService } from '@auto-reply/application/replies.service';
import { DEFAULT_INTERVAL_SECONDS } from '@auto-reply/domain/auto-reply-settings';
import { AUTO_REPLY_SETTINGS_REPOSITORY_PORT } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import type { AutoReplySettingsRepositoryPort } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';

const FIRST_LOOK_MS = 5_000;
const AFTER_CHANGE_MS = 1_000;

/**
 * Mira los mensajes nuevos cada tantos segundos como diga el ajuste. El tiempo se lee en cada vuelta, no al arrancar, así
 * que cambiarlo en la pantalla vale desde la siguiente vuelta sin reiniciar el servidor.
 */
@Injectable()
export class AutoReplyScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AutoReplyScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly incoming: IncomingMessagesService,
    private readonly replies: RepliesService,
    @Inject(AUTO_REPLY_SETTINGS_REPOSITORY_PORT)
    private readonly settings: AutoReplySettingsRepositoryPort,
  ) {}

  onApplicationBootstrap(): void {
    this.schedule(FIRST_LOOK_MS);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Los ajustes cambiaron: se vuelve a mirar pronto, con el tiempo nuevo. */
  reschedule(): void {
    if (!this.running) this.schedule(AFTER_CHANGE_MS);
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.cycle(), delayMs);
    this.timer.unref();
  }

  private async cycle(): Promise<void> {
    this.running = true;
    let nextMs = DEFAULT_INTERVAL_SECONDS * 1000;
    try {
      const settings = await this.settings.get();
      nextMs = settings.intervalSeconds * 1000;
      if (
        settings.enabled &&
        settings.contacts.length > 0 &&
        this.incoming.isEnabled()
      ) {
        const found = await this.replies.run();
        const pending = found.filter((message) => !message.repliedByMe);
        if (pending.length > 0) {
          this.logger.log(
            `${pending.length} new message(s) waiting for a reply`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Looking for new messages failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
      this.schedule(nextMs);
    }
  }
}
