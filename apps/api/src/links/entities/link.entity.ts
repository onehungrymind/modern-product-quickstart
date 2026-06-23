import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('links')
export class LinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  slug!: string;

  @Column({ type: 'text', name: 'target_url' })
  targetUrl!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Index()
  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;
}
