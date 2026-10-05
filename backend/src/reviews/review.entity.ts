import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ReviewKind = 'review' | 'report';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  authorId: string;

  @Index()
  @Column({ type: 'uuid' })
  teacherId: string;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', default: 'review' })
  kind: ReviewKind;

  @CreateDateColumn()
  createdAt: Date;
}
