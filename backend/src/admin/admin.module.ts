import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offering } from '../offerings/offering.entity';
import { Subject } from '../offerings/subject.entity';
import { AdminSubjectsController } from './admin-subjects.controller';
import { SubjectModerationService } from './subject-moderation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subject, Offering])],
  controllers: [AdminSubjectsController],
  providers: [SubjectModerationService],
})
export class AdminModule {}
