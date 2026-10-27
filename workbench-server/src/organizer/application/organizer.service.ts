import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable } from '@nestjs/common';
import { OrganizerSession } from '@organizer/domain/entities/organizer-session.entity';
import {
  GROUPS_GATEWAY_PORT,
  type GroupInfo,
  type GroupsGatewayPort,
} from '@organizer/domain/ports/groups-gateway.port';
import {
  ORGANIZER_SESSION_REPOSITORY_PORT,
  type OrganizerSessionRepositoryPort,
} from '@organizer/domain/ports/organizer-session-repository.port';

export interface SessionSummary {
  session: OrganizerSession;
  memberCount: number;
}

export interface SessionDetail {
  session: OrganizerSession;
  group: GroupInfo;
}

/**
 * El organizador: una sesión es una tarea-grupo (de ahí cuelgan la conversación, el plan y la ejecución, que son los de siempre) con
 * un título y las tareas que reúne. Aquí solo se arma el grupo; planificarlo y ejecutarlo se hace como con cualquier tarea.
 */
@Injectable()
export class OrganizerService {
  constructor(
    @Inject(ORGANIZER_SESSION_REPOSITORY_PORT)
    private readonly sessions: OrganizerSessionRepositoryPort,
    @Inject(GROUPS_GATEWAY_PORT)
    private readonly groups: GroupsGatewayPort,
  ) {}

  async list(): Promise<SessionSummary[]> {
    const all = await this.sessions.findAll();
    return Promise.all(
      all.map(async (session) => ({
        session,
        memberCount: (await this.groups.getGroup(session.groupIssueId)).members
          .length,
      })),
    );
  }

  async create(data: {
    title: string;
    projectId: string;
    notes?: string | null;
  }): Promise<SessionDetail> {
    // El título se valida antes de crear la tarea del grupo, para no dejar una tarea huérfana.
    const title = OrganizerSession.cleanTitle(data.title);
    const groupIssueId = await this.groups.createGroup({
      title,
      projectId: data.projectId,
      notes: data.notes,
    });
    const session = await this.sessions.save(
      OrganizerSession.create({ title, groupIssueId }),
    );
    return { session, group: await this.groups.getGroup(groupIssueId) };
  }

  async get(id: string): Promise<SessionDetail> {
    const session = await this.find(id);
    return { session, group: await this.groups.getGroup(session.groupIssueId) };
  }

  async update(
    id: string,
    data: { title?: string; notes?: string | null },
  ): Promise<SessionDetail> {
    const session = await this.find(id);
    if (data.title !== undefined) session.rename(data.title);
    await this.groups.update(session.groupIssueId, {
      ...(data.title !== undefined ? { title: session.title } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    });
    await this.sessions.save(session);
    return { session, group: await this.groups.getGroup(session.groupIssueId) };
  }

  /** Las tareas del grupo, exactamente estas y en este orden (el orden es el de los pasos). */
  async setMembers(id: string, issueIds: string[]): Promise<SessionDetail> {
    const session = await this.find(id);
    await this.groups.setMembers(session.groupIssueId, issueIds);
    return { session, group: await this.groups.getGroup(session.groupIssueId) };
  }

  /** Borra la sesión y la tarea del grupo; sus tareas quedan libres. */
  async remove(id: string): Promise<void> {
    const session = await this.find(id);
    // La sesión sale con la tarea del grupo (en cascada).
    await this.groups.delete(session.groupIssueId);
  }

  private async find(id: string): Promise<OrganizerSession> {
    const session = await this.sessions.findById(id);
    if (!session) {
      throw DomainError.notFound(`Organizer session ${id} not found`);
    }
    return session;
  }
}
