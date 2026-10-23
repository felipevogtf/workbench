import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatAttachment } from '@shared/chat/chat.models';
import { API_BASE_URL } from './api-base-url.token';

/** Sube los archivos que se adjuntan a un mensaje del chat; devuelve el adjunto con el id que lo referencia. */
@Injectable({ providedIn: 'root' })
export class ChatAttachmentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/chat/attachments`;

  upload(file: File): Observable<ChatAttachment> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ChatAttachment>(this.url, form);
  }
}
