import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [],
  exports: [],
  controllers: [BoardController],
})
export class KanbanModule {}
