import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';
import type { Server } from 'node:http';
import { DomainErrorFilter } from '@core/http/domain-error.filter';
import { ChatMessageDto } from '@pr-review/dto/chat.dto';
import { PlanChatMessageDto } from '@planner/dto/plan.dto';
import { MAX_ATTACHMENT_BYTES } from './attachments';
import { ChatAttachmentsModule } from './chat-attachments.module';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n');

/** Lo que responde el endpoint, o el error que devuelve. */
interface ApiBody {
  id: string;
  name: string;
  message: string;
}

describe('POST /chat/attachments', () => {
  let app: INestApplication;
  let root: string;
  const http = () => app.getHttpServer() as Server;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'attachments-e2e-'));
    process.env.CHAT_ATTACHMENTS_DIR = root;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ChatAttachmentsModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.CHAT_ATTACHMENTS_DIR;
    await rm(root, { recursive: true, force: true });
  });

  it('saves a PDF and answers with the id to reference it', async () => {
    const response = await request(http())
      .post('/chat/attachments')
      .attach('file', PDF, 'informe.pdf')
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'informe.pdf',
      kind: 'pdf',
      mime: 'application/pdf',
      size: PDF.length,
    });
    expect(await readdir(join(root, (response.body as ApiBody).id))).toEqual([
      'informe.pdf',
    ]);
  });

  it('reads the name with accents as the browser sends it', async () => {
    const response = await request(http())
      .post('/chat/attachments')
      .attach('file', Buffer.from('a,b\n1,2'), 'Reunión ñandú.csv')
      .expect(201);

    expect((response.body as ApiBody).name).toBe('Reunión ñandú.csv');
  });

  it('answers 400 for a type that is not accepted', async () => {
    const response = await request(http())
      .post('/chat/attachments')
      .attach('file', Buffer.from('MZ contenido'), 'programa.exe')
      .expect(400);

    expect((response.body as ApiBody).message).toContain('No se puede leer');
  });

  it('answers 400 for an empty file and when no file is sent', async () => {
    await request(http())
      .post('/chat/attachments')
      .attach('file', Buffer.alloc(0), 'vacio.pdf')
      .expect(400);
    await request(http())
      .post('/chat/attachments')
      .field('otro', 'valor')
      .expect(400);
  });

  it('answers 413 for a file over the maximum size', async () => {
    await request(http())
      .post('/chat/attachments')
      .attach(
        'file',
        Buffer.concat([PDF, Buffer.alloc(MAX_ATTACHMENT_BYTES)]),
        'enorme.pdf',
      )
      .expect(413);
  });
});

describe('attachments in the messages of the chats', () => {
  const pipe = new ValidationPipe({ whitelist: true });
  const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

  const errorsOf = async (
    Dto: typeof ChatMessageDto | typeof PlanChatMessageDto,
    plain: object,
  ) =>
    (await validate(plainToInstance(Dto, plain), { whitelist: true })).map(
      (e) => e.property,
    );

  it.each([
    ['pull request chat', ChatMessageDto],
    ['task chat and replan', PlanChatMessageDto],
  ])(
    '%s: accepts a message with and without attachments',
    async (_name, Dto) => {
      expect(await errorsOf(Dto, { role: 'user', content: 'hola' })).toEqual(
        [],
      );
      expect(
        await errorsOf(Dto, {
          role: 'user',
          content: 'hola',
          attachments: [{ id: ID, name: 'a.pdf' }],
        }),
      ).toEqual([]);
    },
  );

  it.each([
    ['pull request chat', ChatMessageDto],
    ['task chat and replan', PlanChatMessageDto],
  ])(
    '%s: refuses more than 5 attachments, a bad id and a nameless attachment',
    async (_name, Dto) => {
      const many = Array.from({ length: 6 }, () => ({ id: ID, name: 'a.pdf' }));

      expect(
        await errorsOf(Dto, {
          role: 'user',
          content: 'hola',
          attachments: many,
        }),
      ).toEqual(['attachments']);
      expect(
        await errorsOf(Dto, {
          role: 'user',
          content: 'hola',
          attachments: [{ id: '../../etc', name: 'a.pdf' }],
        }),
      ).toEqual(['attachments']);
      expect(
        await errorsOf(Dto, {
          role: 'user',
          content: 'hola',
          attachments: [{ id: ID, name: '' }],
        }),
      ).toEqual(['attachments']);
      expect(pipe).toBeDefined();
    },
  );
});
