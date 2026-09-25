import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { LedgerService } from '../ledger/ledger.service';
import { OfferingsService } from '../offerings/offerings.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly ledger: LedgerService,
    private readonly offerings: OfferingsService,
  ) {}

  @Get('me')
  @SkipOfferingRequired()
  me(@CurrentUser() user: User) {
    return this.toProfile(user);
  }

  @Patch('me')
  @SkipOfferingRequired()
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const updated = await this.users.updateProfile(user.id, dto);
    return this.toProfile(updated);
  }

  private async toProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      balance: await this.ledger.balanceFor(user.id),
      offeringCount: await this.offerings.countFor(user.id),
    };
  }
}
