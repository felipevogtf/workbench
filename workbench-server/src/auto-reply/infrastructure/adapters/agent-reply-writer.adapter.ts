import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { AgentsService } from '@ai-agents/application/agents.service';
import type { ReplyWriterPort } from '@auto-reply/domain/ports/reply-writer.port';

/** Único punto del módulo que conoce a ai-agents. El agente corre en una carpeta vacía: no tiene nada que leer. */
@Injectable()
export class AgentReplyWriterAdapter implements ReplyWriterPort {
  constructor(private readonly agents: AgentsService) {}

  async write(prompt: string): Promise<string> {
    const workdir = await mkdtemp(join(tmpdir(), 'auto-reply-'));
    const result = await this.agents.run({
      module: 'auto-reply',
      prompt,
      workdir,
    });
    return result.output;
  }
}
