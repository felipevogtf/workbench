import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssueGroupRepositoryPort } from '@tasks/domain/ports/issue-group-repository.port';
import { IssueGroupMemberOrmEntity } from '@tasks/infrastructure/persistence/issue-group-member.orm-entity';

@Injectable()
export class TypeOrmIssueGroupRepository implements IssueGroupRepositoryPort {
  constructor(
    @InjectRepository(IssueGroupMemberOrmEntity)
    private readonly ormRepo: Repository<IssueGroupMemberOrmEntity>,
  ) {}

  async memberIds(groupId: string): Promise<string[]> {
    const rows = await this.ormRepo.find({
      where: { group_issue_id: groupId },
      order: { position: 'ASC' },
    });
    return rows.map((row) => row.member_issue_id);
  }

  async groupOf(memberId: string): Promise<string | null> {
    const row = await this.ormRepo.findOne({
      where: { member_issue_id: memberId },
    });
    return row?.group_issue_id ?? null;
  }

  async setMembers(groupId: string, memberIds: string[]): Promise<void> {
    await this.ormRepo.manager.transaction(async (manager) => {
      await manager.delete(IssueGroupMemberOrmEntity, {
        group_issue_id: groupId,
      });
      if (memberIds.length === 0) return;
      await manager.insert(
        IssueGroupMemberOrmEntity,
        memberIds.map((memberId, position) => ({
          group_issue_id: groupId,
          member_issue_id: memberId,
          position,
        })),
      );
    });
  }
}
