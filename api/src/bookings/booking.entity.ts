import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type BookingStatus = 'confirmed' | 'cancelled';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  slotId: string;

  @Column({ type: 'uuid' })
  learnerId: string;

  @Column({ type: 'uuid' })
  teacherId: string;

  @Column({ type: 'uuid' })
  offeringId: string;

  @Column()
  joinUrl: string;

  @Column({ type: 'varchar', default: 'confirmed' })
  status: BookingStatus;

  @CreateDateColumn()
  createdAt: Date;
}
