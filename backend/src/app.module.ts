import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ClassroomModule } from './classroom/classroom.module';
import { HealthController } from './health.controller';
import { HomeModule } from './home/home.module';
import { HttpErrorFilter } from './common/http-exception.filter';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { MessagesModule } from './messages/messages.module';
import { OfferingRequiredGuard } from './common/offering-required.guard';
import { OfferingsModule } from './offerings/offerings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SlotsModule } from './slots/slots.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    UsersModule,
    OfferingsModule,
    SlotsModule,
    BookingsModule,
    ClassroomModule,
    ReviewsModule,
    MessagesModule,
    HomeModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5432),
      username: process.env.DATABASE_USER ?? 'p2p',
      password: process.env.DATABASE_PASSWORD ?? 'p2p',
      database: process.env.DATABASE_NAME ?? 'p2p_learn',
      autoLoadEntities: true,
      synchronize: true,
    }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpErrorFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: OfferingRequiredGuard },
  ],
})
export class AppModule {}
