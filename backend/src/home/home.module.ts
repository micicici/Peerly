import { Module } from '@nestjs/common';
import { OfferingsModule } from '../offerings/offerings.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { UsersModule } from '../users/users.module';
import { HomeController } from './home.controller';

@Module({
  imports: [OfferingsModule, ReviewsModule, UsersModule],
  controllers: [HomeController],
})
export class HomeModule {}
