import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { LedgerModule } from '../ledger/ledger.module';
import { Slot } from '../slots/slot.entity';
import { User } from '../users/user.entity';
import { Offering } from './offering.entity';
import { OfferingsController } from './offerings.controller';
import { OfferingsService } from './offerings.service';
import { Subject } from './subject.entity';
import { SubjectsController } from './subjects.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Offering, Subject, User, Slot, Booking]),
    LedgerModule,
  ],
  controllers: [OfferingsController, SubjectsController],
  providers: [OfferingsService],
  exports: [OfferingsService],
})
export class OfferingsModule {}
