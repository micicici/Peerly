import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type LedgerType = 'starter' | 'spend' | 'earn' | 'refund' | 'reversal';

@Entity('ledger_entries')
@Index('UQ_ledger_starter_per_user', ['userId'], {
  unique: true,
  where: `"type" = 'starter'`,
})
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar' })
  type: LedgerType;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
