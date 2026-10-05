import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Slot } from '../slots/slot.entity';

export type BookingStatus = 'confirmed' | 'cancelled';

export type LessonMaterial = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  slotId: string;

  @ManyToOne(() => Slot, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'slotId' })
  slot: Slot;

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

  @Column({ type: 'jsonb', default: () => "'[]'" })
  materials: LessonMaterial[];

  @CreateDateColumn()
  createdAt: Date;
}
