import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { User } from '../users/user.entity';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user.id, dto.slotId);
  }

  @Get()
  listMine(@CurrentUser() user: User) {
    return this.bookings.listMine(user.id);
  }

  @Post(':id/cancel')
  @HttpCode(201)
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookings.cancelAsTeacher(user.id, id);
  }
}
