import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SlotStatus = 'open' | 'booked' | 'cancelled';

@Entity('slots')
export class Slot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  offeringId: string;

  @Index()
  @Column({ type: 'uuid' })
  teacherId: string;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'varchar', default: 'open' })
  status: SlotStatus;
}
