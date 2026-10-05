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
import { Public } from '../common/public.decorator';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { User } from '../users/user.entity';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { OfferingLevel } from './offering.entity';
import { OfferingsService } from './offerings.service';

/** Create, browse, and edit teaching offerings. */
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
  @SkipOfferingRequired()
  listMine(@CurrentUser() user: User) {
    return this.offerings.listMine(user.id);
  }

  @Public()
  @Get()
  listBrowse(
    @CurrentUser() user: User | undefined,
    @Query('q') q?: string,
    @Query('level') level?: OfferingLevel,
    @Query('languages') languages?: string | string[],
    @Query('subjects') subjects?: string | string[],
  ) {
    return this.offerings.listBrowse(
      user?.id,
      q,
      level,
      asList(languages),
      asList(subjects).filter(isUuid),
    );
  }

  @Public()
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

function asList(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }
  const raw = Array.isArray(value) ? value : value.split(',');
  return raw.map((item) => item.trim()).filter(Boolean);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
