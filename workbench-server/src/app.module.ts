import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasksModule } from '@tasks/tasks.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [CoreModule, TasksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
