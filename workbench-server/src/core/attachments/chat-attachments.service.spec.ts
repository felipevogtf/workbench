import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@core/domain/domain.error';
import { MAX_ATTACHMENT_BYTES } from './attachments';
import { ChatAttachmentsService } from './chat-attachments.service';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n');
const DAY = 24 * 60 * 60 * 1000;

describe('ChatAttachmentsService', () => {
  let root: string;
  let workdir: string;
  let service: ChatAttachmentsService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'attachments-store-'));
    workdir = await mkdtemp(join(tmpdir(), 'attachments-workdir-'));
    service = new ChatAttachmentsService({
      get: () => root,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(workdir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('stores the file by id and describes it', async () => {
      const saved = await service.save({
        originalname: 'Informe final.pdf',
        buffer: PDF,
      });

      expect(saved).toMatchObject({
        name: 'Informe final.pdf',
        kind: 'pdf',
        mime: 'application/pdf',
        size: PDF.length,
      });
      expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
      const [stored] = await readdir(join(root, saved.id));
      expect(stored).toBe('Informe_final.pdf');
      expect(await readFile(join(root, saved.id, stored))).toEqual(PDF);
    });

    it('reads a name with accents that arrives as latin1, like multer gives it', async () => {
      const latin1 = Buffer.from('Reunión ñandú.csv', 'utf8').toString(
        'latin1',
      );

      const saved = await service.save({
        originalname: latin1,
        buffer: Buffer.from('a,b\n1,2'),
      });

      expect(saved.name).toBe('Reunión ñandú.csv');
      const [stored] = await readdir(join(root, saved.id));
      expect(stored).toBe('Reunión_ñandú.csv');
    });

    it('saves it with the extension of its content and a name that cannot leave the folder', async () => {
      const saved = await service.save({
        originalname: '../../etc/passwd.txt',
        buffer: PDF,
      });

      const [stored] = await readdir(join(root, saved.id));
      expect(stored).toBe('passwd.pdf');
    });

    it('refuses an empty file, a type that is not accepted and a file that is too large', async () => {
      await expect(
        service.save({ originalname: 'a.pdf', buffer: Buffer.alloc(0) }),
      ).rejects.toThrow(/vacío/);
      await expect(
        service.save({
          originalname: 'programa.exe',
          buffer: Buffer.from('MZ contenido'),
        }),
      ).rejects.toThrow(/PDF, una imagen/);
      await expect(
        service.save({
          originalname: 'enorme.pdf',
          buffer: Buffer.concat([PDF, Buffer.alloc(MAX_ATTACHMENT_BYTES)]),
        }),
      ).rejects.toThrow(/máximo es 10\.0 MB/);
      await expect(
        service.save({ originalname: 'a.pdf', buffer: Buffer.alloc(0) }),
      ).rejects.toBeInstanceOf(DomainError);
    });
  });

  describe('stage', () => {
    it('leaves the attachments in the .attachments folder of the workdir and says where', async () => {
      const pdf = await service.save({
        originalname: 'informe.pdf',
        buffer: PDF,
      });
      const csv = await service.save({
        originalname: 'datos.csv',
        buffer: Buffer.from('a,b\n1,2'),
      });

      const staged = await service.stage(
        [
          { id: pdf.id, name: 'informe.pdf' },
          { id: csv.id, name: 'datos.csv' },
        ],
        workdir,
      );

      expect(staged.get(pdf.id)).toMatchObject({
        name: 'informe.pdf',
        kind: 'pdf',
        path: `.attachments/${pdf.id}-informe.pdf`,
        size: PDF.length,
      });
      expect(staged.get(csv.id)).toMatchObject({
        kind: 'text',
        path: `.attachments/${csv.id}-datos.csv`,
      });
      expect(await readFile(join(workdir, staged.get(pdf.id)!.path))).toEqual(
        PDF,
      );
    });

    it('does nothing without attachments, not even creating the folder', async () => {
      const staged = await service.stage([], workdir);

      expect(staged.size).toBe(0);
      expect(await readdir(workdir)).toEqual([]);
    });

    it('can be done again without problems (two questions in a row)', async () => {
      const pdf = await service.save({
        originalname: 'informe.pdf',
        buffer: PDF,
      });
      const refs = [{ id: pdf.id, name: 'informe.pdf' }];

      const first = await service.stage(refs, workdir);
      const second = await service.stage(refs, workdir);

      expect(second.get(pdf.id)).toEqual(first.get(pdf.id));
      expect(await readdir(join(workdir, '.attachments'))).toHaveLength(1);
    });

    it('leaves out the attachments that no longer exist, and the ids that are not valid', async () => {
      const pdf = await service.save({
        originalname: 'informe.pdf',
        buffer: PDF,
      });
      await rm(join(root, pdf.id), { recursive: true });

      const staged = await service.stage(
        [
          { id: pdf.id, name: 'informe.pdf' },
          { id: '00000000-0000-0000-0000-000000000000', name: 'fantasma.pdf' },
          { id: '../../etc', name: 'ataque.pdf' },
          { id: 'no-es-un-uuid', name: 'raro.pdf' },
        ],
        workdir,
      );

      expect(staged.size).toBe(0);
    });

    it('does not repeat an attachment that is referenced twice', async () => {
      const pdf = await service.save({
        originalname: 'informe.pdf',
        buffer: PDF,
      });
      const ref = { id: pdf.id, name: 'informe.pdf' };

      const staged = await service.stage([ref, ref], workdir);

      expect(staged.size).toBe(1);
    });

    it('removes what was left in the workdir long ago, but not what is in use', async () => {
      const current = await service.save({
        originalname: 'actual.pdf',
        buffer: PDF,
      });
      const target = join(workdir, '.attachments');
      await service.stage([{ id: current.id, name: 'actual.pdf' }], workdir);
      const oldFile = join(
        target,
        '11111111-1111-1111-1111-111111111111-viejo.pdf',
      );
      const recentFile = join(
        target,
        '22222222-2222-2222-2222-222222222222-reciente.pdf',
      );
      await writeFile(oldFile, PDF);
      await writeFile(recentFile, PDF);
      await utimes(
        oldFile,
        new Date(Date.now() - 8 * DAY),
        new Date(Date.now() - 8 * DAY),
      );

      await service.stage([{ id: current.id, name: 'actual.pdf' }], workdir);

      const left = await readdir(target);
      expect(left).toContain(`${current.id}-actual.pdf`);
      expect(left).toContain(
        '22222222-2222-2222-2222-222222222222-reciente.pdf',
      );
      expect(left).not.toContain(
        '11111111-1111-1111-1111-111111111111-viejo.pdf',
      );
    });

    it('removes the stored attachments that have not been used for a week', async () => {
      const old = await service.save({
        originalname: 'viejo.pdf',
        buffer: PDF,
      });
      await utimes(
        join(root, old.id),
        new Date(Date.now() - 8 * DAY),
        new Date(Date.now() - 8 * DAY),
      );
      // Un servicio nuevo no ha limpiado todavía en esta hora.
      const fresh = new ChatAttachmentsService({
        get: () => root,
      } as unknown as ConfigService);
      const recent = await fresh.save({
        originalname: 'reciente.pdf',
        buffer: PDF,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      await expect(stat(join(root, old.id))).rejects.toThrow();
      await expect(stat(join(root, recent.id))).resolves.toBeDefined();
    });
  });
});
