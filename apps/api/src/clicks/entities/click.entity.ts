import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('clicks')
export class ClickEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'link_id' })
  linkId!: string;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'varchar', name: 'ip_hash', nullable: true })
  ipHash!: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'text', nullable: true })
  referrer!: string | null;

  @Column({ type: 'varchar', nullable: true })
  country!: string | null;
}
