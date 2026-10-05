import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsUUID, MinLength } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SkipOfferingRequired } from '../common/skip-offering-required.decorator';
import { User } from '../users/user.entity';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @IsUUID()
  toId: string;

  @IsString()
  @MinLength(1)
  body: string;
}

/** Send a message and read a conversation. */
@Controller('messages')
@UseGuards(JwtAuthGuard)
@SkipOfferingRequired()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  send(@CurrentUser() user: User, @Body() dto: SendMessageDto) {
    return this.messages.send(user.id, dto.toId, dto.body);
  }

  @Get('conversations')
  conversations(@CurrentUser() user: User) {
    return this.messages.conversations(user.id);
  }

  @Get()
  thread(@CurrentUser() user: User, @Query('with') otherId: string) {
    return this.messages.thread(user.id, otherId);
  }
}
