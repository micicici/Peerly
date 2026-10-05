import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

/** Builds a unique Jitsi room URL for a booking. */
@Injectable()
export class MeetingsService {
  createJoinUrl(): string {
    return `https://meet.jit.si/p2plearn-${randomUUID()}`;
  }
}
