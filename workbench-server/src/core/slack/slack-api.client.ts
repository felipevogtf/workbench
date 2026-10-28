import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

const API = 'https://slack.com/api/';
const REQUEST_TIMEOUT_MS = 30_000;

export interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Llama a la API web de Slack con la sesión del usuario (token `xoxc` + cookie `xoxd`): lo que se envía sale a su
 * nombre y se puede leer lo que él ve. Sin las dos credenciales no está habilitado y quien lo usa no hace nada.
 */
@Injectable()
export class SlackApiClient {
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

  /** Los parámetros vacíos no se mandan. Lanza si Slack responde `ok: false`. */
  async call(
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
