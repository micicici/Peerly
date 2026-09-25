import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerModule } from '../ledger/ledger.module';
import { User } from '../users/user.entity';
import { Offering } from './offering.entity';
import { OfferingsController } from './offerings.controller';
import { OfferingsService } from './offerings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Offering, User]), LedgerModule],
  controllers: [OfferingsController],
  providers: [OfferingsService],
  exports: [OfferingsService],
})
export class OfferingsModule {}
