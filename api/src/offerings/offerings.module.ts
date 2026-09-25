import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { LedgerModule } from '../ledger/ledger.module';
import { Slot } from '../slots/slot.entity';
import { User } from '../users/user.entity';
import { Offering } from './offering.entity';
import { OfferingsController } from './offerings.controller';
import { OfferingsService } from './offerings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Offering, User, Slot, Booking]),
    LedgerModule,
  ],
  controllers: [OfferingsController],
  providers: [OfferingsService],
  exports: [OfferingsService],
})
export class OfferingsModule {}
