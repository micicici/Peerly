import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ClassroomGateway } from './classroom.gateway';

@Module({
  imports: [AuthModule, BookingsModule],
  providers: [ClassroomGateway],
})
export class ClassroomModule {}
