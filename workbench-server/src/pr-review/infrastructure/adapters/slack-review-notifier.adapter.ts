import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  splitForSlack,
  slackText,
  toSlackMrkdwn,
} from '@pr-review/application/slack-format';
import type {
  ReviewedPullRequest,
  ReviewNotifierPort,
} from '@pr-review/domain/ports/review-notifier.port';

const API = 'https://slack.com/api/';
const REQUEST_TIMEOUT_MS = 30_000;
const USERS_TTL_MS = 60 * 60 * 1000;
const USERS_PAGE_SIZE = 200;
const MAX_USER_PAGES = 20;

interface SlackUser {
  id: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: { real_name?: string; display_name?: string };
}

interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Minúsculas, sin tildes y con espacios simples: «José  Pérez» == «jose perez». */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Manda la revisión por mensaje directo de Slack al autor de la PR, usando la sesión del usuario
 * (token `xoxc` + cookie `xoxd`): el mensaje sale a su nombre. Sin credenciales no hace nada.
 *
 * El autor se resuelve con `SLACK_AUTHOR_MAP` (JSON `{"autor": "U123" | "correo"}`, necesario para
 * GitHub, cuyo login no suele coincidir con el nombre en Slack) o, si no está, por nombre exacto.
 */
@Injectable()
export class SlackReviewNotifierAdapter implements ReviewNotifierPort {
  private readonly logger = new Logger(SlackReviewNotifierAdapter.name);
  private users: { at: number; list: SlackUser[] } | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return Boolean(
      this.config.get('SLACK_XOXC_TOKEN') &&
      this.config.get('SLACK_XOXD_COOKIE'),
    );
  }

  async notifyAuthor(
    pullRequest: ReviewedPullRequest,
    markdown: string,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const userId = await this.resolveUser(pullRequest.author);
    if (!userId) {
      this.logger.warn(
        `No Slack user found for PR author "${pullRequest.author}"; set SLACK_AUTHOR_MAP`,
      );
      return;
    }

    const opened = await this.call('conversations.open', { users: userId });
    const channel = (opened.channel as { id: string }).id;

    const header =
      `*Revisión automática de tu PR, generada por IA (borrador, puede contener errores)*\n` +
      `<${pullRequest.url}|${slackText(pullRequest.title)}>\n` +
      `${slackText(pullRequest.repo)} · ${pullRequest.provider} #${pullRequest.externalId}`;
    const posted = await this.call('chat.postMessage', {
      channel,
      text: header,
      unfurl_links: 'false',
    });

    // La revisión va en el hilo del aviso para no inundar el mensaje directo.
    for (const chunk of splitForSlack(toSlackMrkdwn(markdown))) {
      await this.call('chat.postMessage', {
        channel,
        thread_ts: posted.ts as string,
        text: chunk,
        unfurl_links: 'false',
      });
    }
  }

  private async resolveUser(author: string): Promise<string | null> {
    const mapped = this.authorMap()[author];
    if (mapped) {
      if (/^[UW][A-Z0-9]+$/.test(mapped)) return mapped;
      const found = await this.call('users.lookupByEmail', {
        email: mapped,
      }).catch(() => null);
      return (found?.user as { id: string } | undefined)?.id ?? null;
    }

    const wanted = normalizeName(author);
    const matches = (await this.loadUsers()).filter(
      (user) =>
        !user.deleted &&
        !user.is_bot &&
        [user.profile?.real_name, user.profile?.display_name, user.name].some(
          (name) => name && normalizeName(name) === wanted,
        ),
    );
    // Si hay más de uno no se adivina: mejor no enviar que enviarlo a otra persona.
    return matches.length === 1 ? matches[0].id : null;
  }

  private authorMap(): Record<string, string> {
    const raw = this.config.get<string>('SLACK_AUTHOR_MAP');
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      this.logger.warn('SLACK_AUTHOR_MAP is not valid JSON; ignoring it');
      return {};
    }
  }

  private async loadUsers(): Promise<SlackUser[]> {
    if (this.users && Date.now() - this.users.at < USERS_TTL_MS) {
      return this.users.list;
    }
    const list: SlackUser[] = [];
    let cursor = '';
    for (let page = 0; page < MAX_USER_PAGES; page++) {
      const out = await this.call('users.list', {
        limit: String(USERS_PAGE_SIZE),
        cursor,
      });
      list.push(...((out.members as SlackUser[] | undefined) ?? []));
      cursor =
        (out.response_metadata as { next_cursor?: string } | undefined)
          ?.next_cursor ?? '';
      if (!cursor) break;
    }
    this.users = { at: Date.now(), list };
    return list;
  }

  private async call(
    method: string,
    params: Record<string, string>,
  ): Promise<SlackResponse> {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) form.set(key, value);
    }
    const { data } = await firstValueFrom(
      this.http.post<SlackResponse>(API + method, form.toString(), {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow<string>('SLACK_XOXC_TOKEN')}`,
          Cookie: `d=${this.config.getOrThrow<string>('SLACK_XOXD_COOKIE')}`,
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
      }),
    );
    if (!data.ok) throw new Error(`Slack ${method}: ${data.error ?? 'error'}`);
    return data;
  }
}
