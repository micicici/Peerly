import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { User } from '../users/user.entity';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { OfferingLevel } from './offering.entity';
import { OfferingsService } from './offerings.service';

@Controller('offerings')
@UseGuards(JwtAuthGuard)
export class OfferingsController {
  constructor(private readonly offerings: OfferingsService) {}

  @Post()
  @SkipOfferingRequired()
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body() dto: CreateOfferingDto) {
    return this.offerings.create(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.offerings.listMine(user.id);
  }

  @Get()
  listBrowse(
    @CurrentUser() user: User,
    @Query('q') q?: string,
    @Query('level') level?: OfferingLevel,
  ) {
    return this.offerings.listBrowse(user.id, q, level);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.offerings.getById(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    return this.offerings.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.offerings.remove(user.id, id);
  }
}
