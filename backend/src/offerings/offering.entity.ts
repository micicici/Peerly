import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type OfferingLevel = 'beginner' | 'intermediate' | 'advanced';

export const OFFERING_LEVELS: OfferingLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
];

@Entity('offerings')
export class Offering {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  teacherId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar' })
  level: OfferingLevel;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  subjectId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
