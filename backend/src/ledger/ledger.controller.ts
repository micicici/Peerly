import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { User } from '../users/user.entity';
import { LedgerService } from './ledger.service';

/** Returns the signed-in user's ledger. */
@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.ledger.listFor(user.id);
  }
}
