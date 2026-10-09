import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { ReviewStoragePort } from '@pr-review/domain/ports/review-storage.port';

/**
 * Guarda cada revisión como .md bajo REVIEWS_DIR:
 *   <provider>/<owner>/<repo>/<externalId>-<commit8>-<timestamp>.md
 * y devuelve la ruta relativa a REVIEWS_DIR (siempre con "/").
 */
@Injectable()
export class LocalFileReviewStorageAdapter implements ReviewStoragePort {
  constructor(private readonly config: ConfigService) {}

  private get baseDir(): string {
    return resolve(this.config.getOrThrow<string>('REVIEWS_DIR'));
  }

  async save(
    pullRequest: PullRequest,
    commit: string,
    markdown: string,
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const fileName = `${this.safe(pullRequest.externalId)}-${this.safe(commit.slice(0, 8))}-${timestamp}.md`;
    const segments = [
      pullRequest.provider,
      ...pullRequest.repo.split('/').map((part) => this.safe(part)),
      fileName,
    ];

    const target = this.resolveInside(segments.join('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, markdown, 'utf-8');

    return segments.join('/');
  }

  async read(docPath: string): Promise<string> {
    return readFile(this.resolveInside(docPath), 'utf-8');
  }

  async remove(docPath: string): Promise<void> {
    await rm(this.resolveInside(docPath), { force: true });
  }

  /** Evita salirse de REVIEWS_DIR con rutas tipo "../". */
  private resolveInside(docPath: string): string {
    const target = resolve(join(this.baseDir, docPath));
    if (!target.startsWith(this.baseDir + sep)) {
      throw new Error('Invalid review path');
    }
    return target;
  }

  private safe(segment: string): string {
    return segment.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_');
  }
}
