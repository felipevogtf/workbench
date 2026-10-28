import { DomainError } from '@core/domain/domain.error';

/** `reply`: el agente redactó la respuesta. `escalate`: no debía responder y se la deja a Felipe. */
export type DraftAction = 'reply' | 'escalate';

/**
 * `pending`: espera que Felipe la apruebe. `sent`: ya salió. `discarded`: la descartó. `escalated`: no se respondió porque
 * le toca a Felipe. `failed`: no se pudo redactar o enviar.
 */
export type DraftStatus =
  'pending' | 'sent' | 'discarded' | 'escalated' | 'failed';

export const MAX_REPLIES = 5;
export const MAX_REPLY_LENGTH = 1000;

export interface IncomingLine {
  ts: string;
  text: string;
}

export interface ReplyDraftProps {
  id: string;
  contactId: string;
  contactName: string;
  channelId: string;
  /** Lo que escribió el contacto y se está respondiendo. */
  incoming: IncomingLine[];
  action: DraftAction;
  replies: string[];
  reason: string | null;
  status: DraftStatus;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

/** Una respuesta redactada por el agente a lo que escribió un contacto, y en qué punto está. */
export class ReplyDraft {
  private constructor(private readonly props: ReplyDraftProps) {}

  static reconstruct(props: ReplyDraftProps): ReplyDraft {
    return new ReplyDraft({ ...props });
  }

  static create(data: {
    contactId: string;
    contactName: string;
    channelId: string;
    incoming: IncomingLine[];
    action: DraftAction;
    replies: string[];
    reason: string | null;
  }): ReplyDraft {
    const replies = data.action === 'reply' ? cleanReplies(data.replies) : [];
    // Una respuesta sin nada que decir no se puede aprobar: queda para que Felipe la vea.
    const writes = data.action === 'reply' && replies.length > 0;
    return new ReplyDraft({
      id: crypto.randomUUID(),
      ...data,
      action: writes ? 'reply' : 'escalate',
      replies,
      status: writes ? 'pending' : 'escalated',
      error: null,
      createdAt: new Date(),
      sentAt: null,
    });
  }

  /** Un borrador que no se pudo ni redactar: queda a la vista para que Felipe responda él. */
  static failed(data: {
    contactId: string;
    contactName: string;
    channelId: string;
    incoming: IncomingLine[];
    error: string;
  }): ReplyDraft {
    return new ReplyDraft({
      id: crypto.randomUUID(),
      contactId: data.contactId,
      contactName: data.contactName,
      channelId: data.channelId,
      incoming: data.incoming,
      action: 'escalate',
      replies: [],
      reason: null,
      status: 'failed',
      error: data.error,
      createdAt: new Date(),
      sentAt: null,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get contactId(): string {
    return this.props.contactId;
  }
  get contactName(): string {
    return this.props.contactName;
  }
  get channelId(): string {
    return this.props.channelId;
  }
  get incoming(): readonly IncomingLine[] {
    return this.props.incoming;
  }
  get action(): DraftAction {
    return this.props.action;
  }
  get replies(): readonly string[] {
    return this.props.replies;
  }
  get reason(): string | null {
    return this.props.reason;
  }
  get status(): DraftStatus {
    return this.props.status;
  }
  get error(): string | null {
    return this.props.error;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get sentAt(): Date | null {
    return this.props.sentAt;
  }

  /** Los mensajes que saldrían: los del agente o, si Felipe los corrigió, los suyos. Solo un borrador pendiente. */
  repliesToSend(edited?: readonly string[]): string[] {
    if (this.props.status !== 'pending') {
      throw DomainError.conflict('Only a pending draft can be sent');
    }
    const replies = cleanReplies(edited ?? this.props.replies);
    if (replies.length === 0) throw new DomainError('There is nothing to send');
    return replies;
  }

  markSent(replies: readonly string[]): void {
    this.props.status = 'sent';
    this.props.replies = [...replies];
    this.props.sentAt = new Date();
    this.props.error = null;
  }

  markFailed(error: string): void {
    this.props.error = error;
  }

  discard(): void {
    if (this.props.status !== 'pending') {
      throw DomainError.conflict('Only a pending draft can be discarded');
    }
    this.props.status = 'discarded';
  }
}

function cleanReplies(replies: readonly string[]): string[] {
  return replies
    .map((reply) => reply.trim().slice(0, MAX_REPLY_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_REPLIES);
}
