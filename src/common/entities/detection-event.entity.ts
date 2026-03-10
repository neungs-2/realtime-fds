import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('detection_events')
@Index(['txHash', 'ruleName'])
export class DetectionEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  chainName!: string;

  @Column({ type: 'integer' })
  chainId!: number;

  @Column({ type: 'varchar', length: 132 })
  txHash!: string;

  @Column({ type: 'bigint' })
  blockNumber!: number;

  @Column({ type: 'timestamptz' })
  blockTimestamp!: Date;

  @Column({ type: 'varchar', length: 132 })
  fromAddress!: string;

  @Column({ type: 'varchar', length: 132, nullable: true })
  toAddress!: string | null;

  @Column({ type: 'varchar', length: 96 })
  valueWei!: string;

  @Column({ type: 'varchar', length: 128 })
  ruleName!: string;

  @Column({ type: 'varchar', length: 16 })
  severity!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  detectedAt!: Date;
}
