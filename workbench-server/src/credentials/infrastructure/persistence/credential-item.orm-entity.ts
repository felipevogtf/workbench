import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('credential_items')
export class CredentialItemOrmEntity {
  // El id lo genera el dominio: se conserva al guardar de nuevo el grupo.
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  group_id!: string;

  @Column()
  key!: string;

  /** Valor cifrado (AES-256-GCM). */
  @Column({ type: 'text' })
  value_enc!: string;

  @Column({ default: false })
  sensitive!: boolean;

  @Column({ type: 'int' })
  position!: number;
}
