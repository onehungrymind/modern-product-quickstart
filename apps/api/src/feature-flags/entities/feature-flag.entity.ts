import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * A runtime feature flag, stored in the database so a release can be toggled
 * WITHOUT redeploying the image (R08 — decouple deploy from release). The image
 * ships with the flag off; flipping the row releases the feature.
 */
@Entity('feature_flags')
export class FeatureFlagEntity {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  key!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
