import { DomainError } from '@core/domain/domain.error';

/** Cada cuánto se mira si llegaron mensajes: lo que Slack aguanta sin pasarse y lo que ya es no mirar. */
export const MIN_INTERVAL_SECONDS = 10;
export const MAX_INTERVAL_SECONDS = 3600;
export const DEFAULT_INTERVAL_SECONDS = 60;
export const MAX_CONTACTS = 10;

/**
 * `draft`: el agente deja un borrador y el usuario lo aprueba. `auto`: responde solo.
 * Mientras no haya respuesta posible, solo se lee.
 */
export const AUTO_REPLY_MODES = ['draft', 'auto'] as const;
export type AutoReplyMode = (typeof AUTO_REPLY_MODES)[number];

export interface AutoReplyContact {
  /** Id de Slack del usuario (U…). */
  userId: string;
  name: string;
  /** Marca de tiempo (`ts` de Slack) del último mensaje ya visto en la conversación; null si aún no se mira. */
  lastSeenTs: string | null;
}

export interface AutoReplySettingsProps {
  enabled: boolean;
  intervalSeconds: number;
  mode: AutoReplyMode;
  contacts: AutoReplyContact[];
}

/** El modo «no molestar»: si está activo, a quién se atiende, cada cuánto se mira y si se responde solo. */
export class AutoReplySettings {
  private constructor(private props: AutoReplySettingsProps) {}

  static defaults(): AutoReplySettings {
    return new AutoReplySettings({
      enabled: false,
      intervalSeconds: DEFAULT_INTERVAL_SECONDS,
      mode: 'draft',
      contacts: [],
    });
  }

  static reconstruct(props: AutoReplySettingsProps): AutoReplySettings {
    return new AutoReplySettings({
      ...props,
      contacts: props.contacts.map((contact) => ({ ...contact })),
    });
  }

  get enabled(): boolean {
    return this.props.enabled;
  }
  get intervalSeconds(): number {
    return this.props.intervalSeconds;
  }
  get mode(): AutoReplyMode {
    return this.props.mode;
  }
  get contacts(): readonly AutoReplyContact[] {
    return this.props.contacts;
  }

  /** Cambia lo que venga. Los contactos que ya estaban conservan lo último que se vio de su conversación. */
  update(changes: {
    enabled?: boolean;
    intervalSeconds?: number;
    mode?: AutoReplyMode;
    contacts?: { userId: string; name: string }[];
  }): void {
    if (changes.intervalSeconds !== undefined) {
      const seconds = changes.intervalSeconds;
      if (
        !Number.isInteger(seconds) ||
        seconds < MIN_INTERVAL_SECONDS ||
        seconds > MAX_INTERVAL_SECONDS
      ) {
        throw new DomainError(
          `The interval must be between ${MIN_INTERVAL_SECONDS} and ${MAX_INTERVAL_SECONDS} seconds`,
        );
      }
      this.props.intervalSeconds = seconds;
    }
    if (changes.mode !== undefined) this.props.mode = changes.mode;
    if (changes.contacts !== undefined) {
      if (changes.contacts.length > MAX_CONTACTS) {
        throw new DomainError(`At most ${MAX_CONTACTS} contacts`);
      }
      const ids = new Set(changes.contacts.map((contact) => contact.userId));
      if (ids.size !== changes.contacts.length) {
        throw new DomainError('A contact appears twice');
      }
      this.props.contacts = changes.contacts.map((contact) => ({
        userId: contact.userId,
        name: contact.name,
        lastSeenTs:
          this.props.contacts.find((known) => known.userId === contact.userId)
            ?.lastSeenTs ?? null,
      }));
    }
    if (changes.enabled !== undefined) this.props.enabled = changes.enabled;
  }

  /** Lo último que se vio de la conversación con un contacto: desde ahí se miran los mensajes nuevos. */
  markSeen(userId: string, ts: string): void {
    const contact = this.props.contacts.find(
      (known) => known.userId === userId,
    );
    if (contact) contact.lastSeenTs = ts;
  }
}
