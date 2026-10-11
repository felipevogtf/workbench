import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CredentialsService } from './application/credentials.service';
import { CREDENTIAL_GROUP_REPOSITORY_PORT } from './domain/ports/credential-group-repository.port';
import { SECRET_CIPHER_PORT } from './domain/ports/secret-cipher.port';
import { AesGcmSecretCipherAdapter } from './infrastructure/adapters/aes-gcm-secret-cipher.adapter';
import { CredentialsController } from './infrastructure/http/credentials.controller';
import { CredentialGroupOrmEntity } from './infrastructure/persistence/credential-group.orm-entity';
import { CredentialItemOrmEntity } from './infrastructure/persistence/credential-item.orm-entity';
import { TypeOrmCredentialGroupRepository } from './infrastructure/repositories/typeorm-credential-group.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CredentialGroupOrmEntity,
      CredentialItemOrmEntity,
    ]),
  ],
  controllers: [CredentialsController],
  providers: [
    CredentialsService,
    {
      provide: CREDENTIAL_GROUP_REPOSITORY_PORT,
      useClass: TypeOrmCredentialGroupRepository,
    },
    { provide: SECRET_CIPHER_PORT, useClass: AesGcmSecretCipherAdapter },
  ],
})
export class CredentialsModule {}
