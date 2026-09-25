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
import { User } from '../users/user.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { SlotsService } from './slots.service';

@Controller('slots')
@UseGuards(JwtAuthGuard)
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body() dto: CreateSlotDto) {
    return this.slots.create(user.id, dto.offeringId, new Date(dto.startAt));
  }

  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.slots.listMine(user.id);
  }

  @Get()
  listOpen(@Query('offeringId') offeringId?: string) {
    if (!offeringId) {
      return [];
    }
    return this.slots.listOpenForOffering(offeringId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.slots.removeOpen(user.id, id);
  }
}
