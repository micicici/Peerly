import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerModule } from '../ledger/ledger.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { Offering } from '../offerings/offering.entity';
import { Subject } from '../offerings/subject.entity';
import { Slot } from '../slots/slot.entity';
import { User } from '../users/user.entity';
import { Booking } from './booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Slot, Offering, Subject, User]),
    LedgerModule,
    MeetingsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
