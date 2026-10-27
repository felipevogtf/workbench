import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '@tasks/tasks.module';
import { OrganizerService } from './application/organizer.service';
import { GROUPS_GATEWAY_PORT } from './domain/ports/groups-gateway.port';
import { ORGANIZER_SESSION_REPOSITORY_PORT } from './domain/ports/organizer-session-repository.port';
import { GroupsGatewayAdapter } from './infrastructure/adapters/groups-gateway.adapter';
import { OrganizerController } from './infrastructure/http/organizer.controller';
import { OrganizerSessionOrmEntity } from './infrastructure/persistence/organizer-session.orm-entity';
import { TypeOrmOrganizerSessionRepository } from './infrastructure/repositories/typeorm-organizer-session.repository';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizerSessionOrmEntity]), TasksModule],
  controllers: [OrganizerController],
  providers: [
    {
      provide: ORGANIZER_SESSION_REPOSITORY_PORT,
      useClass: TypeOrmOrganizerSessionRepository,
    },
    { provide: GROUPS_GATEWAY_PORT, useClass: GroupsGatewayAdapter },
    OrganizerService,
  ],
})
export class OrganizerModule {}
