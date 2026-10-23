import {
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@core/domain/domain.error';
import {
  ATTACHMENTS_DIR,
  AttachmentKind,
  AttachmentRef,
  MAX_ATTACHMENT_BYTES,
  StagedAttachment,
  formatSize,
} from './attachments';
import { detectAttachment } from './detect-attachment';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BASE_NAME_CHARS = 60;

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

export interface SavedAttachment {
  id: string;
  /** Nombre original, para mostrarlo. */
  name: string;
  kind: AttachmentKind;
  mime: string;
  size: number;
}

/** El tipo de un archivo ya guardado, por su extensión (siempre la que corresponde a su contenido). */
function kindOfStored(file: string): AttachmentKind {
  const ext = extname(file).slice(1).toLowerCase();
  if (ext === 'pdf') return 'pdf';
  return ['png', 'jpg', 'gif', 'webp'].includes(ext) ? 'image' : 'text';
}

/**
 * Los nombres con tildes llegan como si fueran latin1 (así los decodifica multer): se vuelven a leer como
 * UTF-8. Si no era un nombre mal decodificado, se deja igual.
 */
function decodeName(raw: string): string {
  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  return decoded.includes('�') ? raw : decoded;
}

/** Un nombre seguro para guardar en disco: sin rutas, sin caracteres raros, con la extensión del contenido. */
function storedName(original: string, ext: string): string {
  const base = basename(original, extname(original))
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^[._]+/, '')
    .slice(0, MAX_BASE_NAME_CHARS);
  return `${base || 'archivo'}.${ext}`;
}

/**
 * Los archivos que se adjuntan al chat. Se guardan por id en `CHAT_ATTACHMENTS_DIR` al subirlos y, en cada
 * pregunta, se copian a la carpeta `.attachments/` del directorio de trabajo del agente para que los lea con
 * su herramienta Read. Se borran a los 7 días sin usarse.
 */
@Injectable()
export class ChatAttachmentsService {
  private readonly logger = new Logger(ChatAttachmentsService.name);
  private lastSweep = 0;

  constructor(private readonly config: ConfigService) {}

  /** Valida y guarda un archivo subido. Solo PDF, imágenes y texto (incluye CSV), hasta el tamaño máximo. */
  async save(upload: UploadedFile): Promise<SavedAttachment> {
    const name = decodeName(upload.originalname) || 'archivo';
    const { buffer } = upload;

    if (buffer.length === 0) {
      throw new DomainError(`El archivo «${name}» está vacío.`);
    }
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new DomainError(
        `El archivo «${name}» pesa ${formatSize(buffer.length)}; el máximo es ${formatSize(MAX_ATTACHMENT_BYTES)}.`,
      );
    }
    const detected = detectAttachment(name, buffer);
    if (!detected) {
      throw new DomainError(
        `No se puede leer «${name}»: adjunta un PDF, una imagen (PNG, JPG, GIF o WebP) o un archivo de texto o CSV.`,
      );
    }

    const id = randomUUID();
    const dir = join(this.root(), id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, storedName(name, detected.ext)), buffer);
    void this.sweep();

    return {
      id,
      name,
      kind: detected.kind,
      mime: detected.mime,
      size: buffer.length,
    };
  }

  /**
   * Deja los adjuntos pedidos en `<workdir>/.attachments/` y devuelve dónde quedó cada uno. Los que ya no
   * existen (o con un id que no es válido) no aparecen en el resultado. No borra nada de lo que el agente
   * pueda estar leyendo: copiar es idempotente y la limpieza solo toca lo viejo.
   */
  async stage(
    refs: readonly AttachmentRef[],
    workdir: string,
  ): Promise<ReadonlyMap<string, StagedAttachment>> {
    const staged = new Map<string, StagedAttachment>();
    if (refs.length === 0) return staged;

    const target = join(workdir, ATTACHMENTS_DIR);
    await mkdir(target, { recursive: true });
    const now = new Date();

    for (const ref of refs) {
      if (staged.has(ref.id) || !UUID.test(ref.id)) continue;

      const source = join(this.root(), ref.id);
      let file: string | undefined;
      try {
        [file] = await readdir(source);
      } catch {
        continue;
      }
      if (!file) continue;

      const dest = join(target, `${ref.id}-${file}`);
      try {
        await copyFile(join(source, file), dest);
        await utimes(source, now, now);
        const { size } = await stat(dest);
        staged.set(ref.id, {
          id: ref.id,
          name: ref.name || file,
          path: `${ATTACHMENTS_DIR}/${basename(dest)}`,
          kind: kindOfStored(file),
          size,
        });
      } catch (error) {
        this.logger.warn(
          `Could not stage attachment ${ref.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await this.removeOldStaged(target, new Set(refs.map((ref) => ref.id)));
    void this.sweep();
    return staged;
  }

  private root(): string {
    return (
      this.config.get<string>('CHAT_ATTACHMENTS_DIR') ||
      join(tmpdir(), 'workbench-chat-attachments')
    );
  }

  /** Los adjuntos que se dejaron en un directorio de trabajo y llevan días sin pedirse. */
  private async removeOldStaged(
    target: string,
    inUse: ReadonlySet<string>,
  ): Promise<void> {
    try {
      const now = Date.now();
      for (const entry of await readdir(target)) {
        if (inUse.has(entry.slice(0, 36))) continue;
        const path = join(target, entry);
        if (now - (await stat(path)).mtimeMs > MAX_AGE_MS) {
          await rm(path, { force: true });
        }
      }
    } catch {
      // La limpieza nunca debe fallar una pregunta.
    }
  }

  /** Borra los adjuntos que llevan días sin usarse. Como mucho una vez por hora; nunca falla. */
  private async sweep(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;

    const root = this.root();
    try {
      for (const entry of await readdir(root)) {
        const path = join(root, entry);
        if (now - (await stat(path)).mtimeMs > MAX_AGE_MS) {
          await rm(path, { recursive: true, force: true });
          this.logger.log(`Removed unused attachment ${entry}`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not clean the attachments: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
