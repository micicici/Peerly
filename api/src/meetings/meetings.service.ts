import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class MeetingsService {
  createJoinUrl(): string {
    return `https://meet.jit.si/p2plearn-${randomUUID()}`;
  }
}
