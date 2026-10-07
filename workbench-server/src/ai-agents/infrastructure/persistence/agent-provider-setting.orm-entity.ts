import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('agent_provider_settings')
export class AgentProviderSettingOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  provider!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}
