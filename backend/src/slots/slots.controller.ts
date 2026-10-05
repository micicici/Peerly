import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { User } from '../users/user.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { SlotsService } from './slots.service';

/** Teaching availability: create, list, and remove open hours. */
@Controller('slots')
@UseGuards(JwtAuthGuard)
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body() dto: CreateSlotDto) {
    return this.slots.create(user.id, new Date(dto.startAt));
  }

  @Get('mine')
  @SkipOfferingRequired()
  listMine(@CurrentUser() user: User) {
    return this.slots.listMine(user.id);
  }

  @Public()
  @Get()
  listOpen(
    @Query('offeringId') offeringId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    if (teacherId) {
      return this.slots.listScheduleForTeacher(teacherId);
    }
    if (offeringId) {
      return this.slots.listOpenForOffering(offeringId);
    }
    return [];
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.slots.removeOpen(user.id, id);
  }
}
