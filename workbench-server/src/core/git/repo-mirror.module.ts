import { Module } from '@nestjs/common';
import { RepoMirrorService } from './repo-mirror';

/** El clon compartido de cada repositorio, con el que el planificador y las revisiones de PRs arman sus worktrees. */
@Module({
  providers: [RepoMirrorService],
  exports: [RepoMirrorService],
})
export class RepoMirrorModule {}
